/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { capturePoolCheckoutSnapshot, readCheckoutProperty } from './pool-checkout-record.js';
import { buildFixtureCheckoutRecord } from './fixture-checkout-record.js';
import { observeOwnedPgConnections } from './owned-pg-connection-observer.js';
import { observeOwnedPgQueue } from './owned-pg-queue-observer.js';

export const fixtureCheckoutMarker = '[fixture-pool-checkout] ';

/** Decorate only an owned instance, retaining the concrete pool and driver API. */
export function observeFixturePoolCheckouts({ pool, poolKind, source, phaseObserver, expectedConfig, startupLogging = false,
  mode = 'failures', captureFailure = null,
  onRecord = record => process.stderr.write(`${fixtureCheckoutMarker}${JSON.stringify(record)}\n`),
  now = () => performance.now() } = {}) {
  if (!['off', 'failures', 'all'].includes(mode) || typeof onRecord !== 'function'
    || typeof now !== 'function' || (captureFailure !== null && typeof captureFailure !== 'function')) {
    throw new TypeError('Invalid fixture checkout diagnostics');
  }
  if (mode === 'off') return { restore: async () => {} };
  if (typeof pool?.connect !== 'function') throw new TypeError('Fixture checkout requires an owned pool');
  const descriptor = Object.getOwnPropertyDescriptor(pool, 'connect');
  const original = pool.connect;
  const queue = observeOwnedPgQueue({ pool, now, runUnobserved: run => connections.unobserved(run) });
  const connections = observeOwnedPgConnections({ pool, expectedConfig, now, startupLogging });
  const captures = new Set(); let ordinaryRecords = 0; let failureRecords = 0;
  function clock() { try { const n = now(); return Number.isFinite(n) ? n : null; } catch { return null; } }
  function publish(record) {
    if (record.outcome === 'failed' ? failureRecords++ >= 16 : ordinaryRecords++ >= 128) return;
    try { Promise.resolve(onRecord(record)).catch(() => {}); } catch { /* Optional telemetry is not authority. */ }
  }
  function capture(error, checkoutId, startupContext) {
    const pending = Promise.resolve().then(() => captureFailure?.(error, checkoutId, startupContext)).catch(() => {});
    captures.add(pending); void pending.then(() => captures.delete(pending));
    return pending;
  }
  function begin() {
    const connection = connections.begin();
    const acquisition = queue.begin(connection);
    const checkoutId = randomUUID(); const started = clock(); const before = capturePoolCheckoutSnapshot(pool);
    const correlationId = readCheckoutProperty(phaseObserver, 'correlationId');
    let phase;
    try { phase = phaseObserver?.currentPhase?.(); } catch { /* Unknown phase is explicit. */ }
    let requested = null;
    function emit(outcome, error) {
      const ended = outcome === 'started' ? null : clock();
      publish(buildFixtureCheckoutRecord({ checkoutId, poolKind, source, phase,
        correlationId, before, requested, connection: connection.snapshot(), acquisition: acquisition.snapshot(),
        settled: outcome === 'started' ? null : capturePoolCheckoutSnapshot(pool), outcome, error,
        durationMs: started !== null && ended !== null ? ended - started : null }));
    }
    if (mode === 'all') emit('started');
    return { dispatch: run => acquisition.dispatch(run),
      requested: () => { requested ??= capturePoolCheckoutSnapshot(pool); },
      passed: () => { acquisition.delivered(); if (mode === 'all') emit('passed'); acquisition.finish(); connection.finish(); },
      failed: error => { emit('failed', error); const context = connection.captureStartupContext();
        acquisition.finish(); connection.finish(); return capture(error, checkoutId, context); } };
  }
  function connect(...args) {
    if (this !== pool) return Reflect.apply(original, this, args);
    const observation = begin();
    if (typeof args[0] === 'function') {
      const callback = args[0]; let callbackEntered = false;
      args[0] = function (...values) {
        callbackEntered = true; observation.requested();
        if (!values[0]) { observation.passed(); return Reflect.apply(callback, this, values); }
        const receiver = this;
        void observation.failed(values[0]).then(() => {
          queueMicrotask(() => { Reflect.apply(callback, receiver, values); });
        });
      };
      try { const result = observation.dispatch(() => Reflect.apply(original, this, args)); observation.requested(); return result; }
      catch (error) { if (!callbackEntered) void observation.failed(error); throw error; }
    }
    let pending;
    try { pending = observation.dispatch(() => Reflect.apply(original, this, args)); observation.requested(); }
    catch (error) { void observation.failed(error); throw error; }
    return pending.then(client => { observation.passed(); return client; }, async error => {
      await observation.failed(error); throw error;
    });
  }
  Object.defineProperty(pool, 'connect', { value: connect, configurable: true, writable: true,
    enumerable: descriptor?.enumerable ?? false });
  return {
    async restore() {
      // Capture may admit another capture while draining; do not leave it behind.
      while (captures.size) await Promise.allSettled([...captures]);
      let failed = false; let failure;
      for (const restore of [() => queue.restore(), () => connections.restore(), () => {
        if (pool.connect !== connect) throw new Error('Fixture checkout observer ownership changed');
        if (descriptor) Object.defineProperty(pool, 'connect', descriptor); else delete pool.connect;
      }]) {
        try { restore(); } catch (error) { if (!failed) { failed = true; failure = error; } }
      }
      if (failed) throw failure;
    },
  };
}

export function resolveFixtureCheckoutMode(env = process.env) {
  const mode = env.HARMONIARR_INTEGRATION_POOL_DIAGNOSTICS ?? 'failures';
  if (!['off', 'failures', 'all'].includes(mode)) throw new TypeError('Invalid fixture checkout diagnostic setting');
  return mode;
}
