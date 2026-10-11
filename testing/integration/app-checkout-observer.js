/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { buildPoolCheckoutRecord, capturePoolCheckoutSnapshot, isCheckoutCorrelationId,
  readCheckoutProperty } from './pool-checkout-record.js';

export const poolCheckoutMarker = '[app-fixture-checkout] ';

export function createPoolCheckoutObserver({ mode = 'failures', onRecord = null,
  now = () => performance.now() } = {}) {
  if (!['off', 'failures', 'all'].includes(mode) || typeof now !== 'function'
    || (onRecord !== null && typeof onRecord !== 'function')) throw new TypeError('Invalid pool checkout observer options');
  function clock() { try { const n = now(); return Number.isFinite(n) ? n : null; } catch { return null; } }
  function publish(record) {
    if (!onRecord) return;
    try { Promise.resolve(onRecord(record)).catch(() => {}); } catch { /* Observation never replaces checkout. */ }
  }

  return { mode,
    async observe(pool, context, operation) {
      if (mode === 'off') return operation();
      const candidate = readCheckoutProperty(context, 'correlationId');
      const correlationId = isCheckoutCorrelationId(candidate) ? candidate : randomUUID();
      const source = readCheckoutProperty(context, 'source');
      const serverPhase = readCheckoutProperty(context, 'serverPhase');
      const started = clock();
      const before = capturePoolCheckoutSnapshot(pool);
      let requested = null;
      const emit = (outcome, error) => {
        const ended = outcome === 'started' ? null : clock();
        publish(buildPoolCheckoutRecord({ correlationId, source, serverPhase, outcome, before, requested,
          settled: outcome === 'started' ? null : capturePoolCheckoutSnapshot(pool), error,
          durationMs: started !== null && ended !== null ? ended - started : null }));
      };
      if (mode === 'all') emit('started');
      try {
        const pending = operation();
        requested = capturePoolCheckoutSnapshot(pool);
        const client = await pending;
        if (mode === 'all') emit('passed');
        return client;
      } catch (error) { emit('failed', error); throw error; }
    },
  };
}

export function createIntegrationPoolCheckoutObserver({ env = process.env,
  onRecord = (record) => { process.stderr.write(`${poolCheckoutMarker}${JSON.stringify(record)}\n`); } } = {}) {
  return createPoolCheckoutObserver({ mode: env.HARMONIARR_INTEGRATION_POOL_DIAGNOSTICS ?? 'failures', onRecord });
}

/** Bootstrap's injection consumes only connect(); this is deliberately not a general Pool facade. */
export function observeAppSchemaPreparation({ prepareDatabaseFn, getPoolFn, observer, source, phaseObserver }) {
  if (observer.mode === 'off') return prepareDatabaseFn({ getPoolFn });
  let observed = false;
  return prepareDatabaseFn({ getPoolFn: () => {
    const pool = getPoolFn();
    return { connect: () => {
      if (observed) return pool.connect();
      observed = true;
      return observer.observe(pool, { source, serverPhase: 'isolated_database_admitted',
        correlationId: readCheckoutProperty(phaseObserver, 'correlationId') }, () => pool.connect());
    } };
  } });
}
