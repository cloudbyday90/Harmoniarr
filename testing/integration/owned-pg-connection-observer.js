/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import PgConnection from 'pg/lib/connection.js';
import pgPackage from 'pg/package.json' with { type: 'json' };
import { buildPgConnectionRecord, capturePgTargetIdentity, comparePgTargetIdentity } from './pg-connection-record.js';

// These are internal driver surfaces, not the public pool.connect event. Refuse
// instrumentation after an unreviewed driver upgrade; ordinary checkout remains.
function supportedDriver() {
  try {
    const metadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.resolve('pg-pool')), 'utf8'));
    return pgPackage.version === '8.23.0' && metadata.version === '3.14.0';
  } catch { return false; }
}
const supported = supportedDriver();

export function observeOwnedPgConnections({ pool, expectedConfig, now }) {
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
      // A queued checkout can create a client later in another release's context.
      // Never attribute that client to the releasing or another waiting checkout.
      try { dispatchOwner?.attach(client); } catch { /* Diagnostics cannot break driver construction. */ }
      return client;
    },
  }) : null;
  if (available) Object.defineProperty(pool, 'Client', { ...descriptor, value: Client });

  return {
    begin() {
      const start = clock(); const data = { observation: initial }; const listeners = [];
      let finished = false; let restoreStartup = null;
      const finish = () => {
        finished = true;
        for (const [emitter, event, listener] of listeners) emitter.removeListener(event, listener);
        restoreStartup?.(); restoreStartup = null;
        listeners.length = 0; active.delete(finish);
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
              const result = Reflect.apply(startup, this, args);
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
