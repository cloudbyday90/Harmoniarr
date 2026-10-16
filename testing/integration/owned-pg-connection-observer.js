/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { randomUUID } from 'node:crypto';
import { types } from 'node:util';
import pg from 'pg';
import PgConnection from 'pg/lib/connection.js';
import { supportsPgObserverDriver } from './pg-observer-driver.js';
import { buildPgConnectionRecord, capturePgTargetIdentity, comparePgTargetIdentity } from './pg-connection-record.js';
import { capturePgStartupContext } from './pg-startup-log-policy.js';

// These are internal driver surfaces, not the public pool.connect event. Refuse
// instrumentation after an unreviewed driver upgrade; ordinary checkout remains.
const supported = supportsPgObserverDriver();

export function observeOwnedPgConnections({ pool, expectedConfig, now, startupLogging = false }) {
  const expected = capturePgTargetIdentity(expectedConfig);
  const available = supported && pool instanceof pg.Pool && pool.Client === pg.Client;
  const initial = available ? 'not_observed' : 'unsupported_driver';
  const descriptor = available ? Object.getOwnPropertyDescriptor(pool, 'Client') : null;
  const original = available ? pool.Client : null;
  const active = new Set(); let dispatchOwner = null;
  function clock() { try { const value = now(); return Number.isFinite(value) ? value : null; } catch { return null; } }

  const Client = available ? new Proxy(original, {
    construct(target, args, newTarget) {
      const client = Reflect.construct(target, args, newTarget);
      // The owned queue adapter re-enters only the exact PendingItem's owner.
      // Standalone callers retain synchronous construction-only observation.
      try { dispatchOwner?.attach(client); } catch { /* Diagnostics cannot break driver construction. */ }
      return client;
    },
  }) : null;
  if (available) Object.defineProperty(pool, 'Client', { ...descriptor, value: Client });

  return {
    unobserved(run) {
      const previous = dispatchOwner; dispatchOwner = null;
      try { return run(); } finally { dispatchOwner = previous; }
    },
    begin() {
      const start = clock(); const data = { observation: initial }; const listeners = [];
      let finished = false; let restoreStartup = null; let startupContext = null;
      const finish = () => {
        finished = true;
        for (const [emitter, event, listener] of listeners) emitter.removeListener(event, listener);
        restoreStartup?.(); restoreStartup = null;
        listeners.length = 0; active.delete(finish);
        startupContext = null;
      };
      function mark(stage, field) {
        if (finished || Object.hasOwn(data, field)) return;
        const end = clock(); data.lastStage = stage;
        data[field] = start !== null && end !== null ? end - start : null;
      }
      function listen(emitter, event, listener) {
        const safeListener = () => { try { listener(); } catch { data.observation = 'adapter_unavailable'; } };
        emitter.once(event, safeListener); listeners.push([emitter, event, safeListener]);
      }
      const owner = {
        attach(client) {
          if (finished || data.observation === 'observed') return;
          try {
            const connection = client.connection;
            if (!(connection instanceof PgConnection)) { data.observation = 'unsupported_driver'; return; }
            data.observation = 'observed'; data.clientId = randomUUID();
            data.targetMatch = comparePgTargetIdentity(client, expected);
            mark('constructed', 'constructedMs'); active.add(finish);
            const startupDescriptor = Object.getOwnPropertyDescriptor(connection, 'startup');
            const startup = connection.startup;
            function observedStartup(...args) {
              let submitted = args;
              if (!finished && this === connection && startupLogging === true && data.targetMatch === 'matched') {
                try {
                  const packet = args[0];
                  // Installed pg emits a plain packet. Preserve explicit application names and unsupported shapes.
                  const fields = packet && !types.isProxy(packet) && Object.getPrototypeOf(packet) === Object.prototype
                    ? Object.getOwnPropertyDescriptors(packet) : null;
                  if (fields && Object.values(fields).every(d => Object.hasOwn(d, 'value'))
                    && !fields.application_name?.value && fields.user?.value === expected.user && fields.database?.value === expected.database) {
                    const context = capturePgStartupContext({ marker: `hxi_${randomUUID()}`, clientId: data.clientId,
                      user: expected.user, database: expected.database });
                    if (context) { startupContext = context; submitted = [{ ...packet, application_name: context.marker }, ...args.slice(1)]; }
                  }
                } catch { /* Optional marker preparation must not replace the startup call. */ }
              }
              const result = Reflect.apply(startup, this, submitted);
              if (this === connection) mark('startup_dispatched', 'startupDispatchedMs');
              return result;
            }
            Object.defineProperty(connection, 'startup', { value: observedStartup, writable: true, configurable: true,
              enumerable: startupDescriptor?.enumerable ?? false });
            restoreStartup = () => {
              // Never overwrite a later owner's mutation.
              if (connection.startup !== observedStartup) return;
              if (startupDescriptor) Object.defineProperty(connection, 'startup', startupDescriptor);
              else delete connection.startup;
            };
            listen(connection, 'connect', () => mark('transport_connected', 'transportConnectedMs'));
            listen(connection, 'sslconnect', () => {
              mark('tls_stream_created', 'tlsStreamCreatedMs');
              // pg emits sslconnect when it creates the TLS stream, before the
              // actual TLS handshake. Observe Node's secureConnect separately.
              listen(connection.stream, 'secureConnect', () => mark('tls_connected', 'tlsConnectedMs'));
            });
            for (const event of ['authenticationCleartextPassword', 'authenticationMD5Password', 'authenticationSASL']) {
              listen(connection, event, () => mark('authentication_requested', 'authenticationRequestedMs'));
            }
            listen(connection, 'authenticationOk', () => mark('authentication_accepted', 'authenticationAcceptedMs'));
            listen(connection, 'readyForQuery', () => mark('backend_ready', 'backendReadyMs'));
          } catch {
            finish(); data.observation = 'adapter_unavailable';
          }
        },
      };
      return {
        dispatch(run) {
          const previous = dispatchOwner; dispatchOwner = owner;
          try { return run(); } finally { dispatchOwner = previous; }
        },
        snapshot: () => buildPgConnectionRecord(data),
        captureStartupContext: () => startupContext,
        finish,
      };
    },
    restore() {
      for (const finish of active) finish();
      if (!available) return;
      if (pool.Client !== Client) throw new Error('Fixture connection observer ownership changed');
      Object.defineProperty(pool, 'Client', descriptor);
    },
  };
}
