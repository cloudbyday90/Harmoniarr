/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { performance } from 'node:perf_hooks';
import { buildPostgresFailureRecord } from './postgres-failure-record.js';
import { createPostgresHostProbe } from './postgres-host-probe.js';
import { createPostgresReadinessProbe, isOwnedContainerId } from './postgres-readiness-probe.js';
import { readCheckoutProperty } from './pool-checkout-record.js';

export const postgresFailureMarker = '[postgres-fixture-failure] ';
/** Bind evidence to one scenario, registering its canonical completion before probing. */
export function createPostgresFailureEvidence({ mode = 'failures', source, connectionConfig,
  containerId, fresh = false, hostProbeFactory = createPostgresHostProbe,
  readinessProbeFactory = createPostgresReadinessProbe,
  onRecord = record => process.stderr.write(`${postgresFailureMarker}${JSON.stringify(record)}\n`),
  now = () => performance.now() } = {}) {
  if (!['off', 'failures'].includes(mode) || typeof onRecord !== 'function' || typeof now !== 'function') {
    throw new TypeError('Invalid PostgreSQL failure evidence options');
  }
  const owned = source === 'testcontainer_postgres' && fresh && isOwnedContainerId(containerId);
  function clock() { try { const n = now(); return Number.isFinite(n) ? n : null; } catch { return null; } }
  return {
    createCapture({ correlationId, signal } = {}) {
      let capturing;
      return function captureServerFailure(error, phase = 'database_scenario') {
        if (mode === 'off') return Promise.resolve();
        if (capturing) return capturing;
        const completion = Promise.withResolvers();
        capturing = completion.promise;
        Promise.resolve().then(async () => {
          const started = clock();
          const cancelled = readCheckoutProperty(signal, 'aborted') === true;
          let host = { outcome: 'unavailable', stage: cancelled ? 'cancelled' : 'not_owned' };
          let readiness = { outcome: 'unavailable' };
          if (owned && !cancelled) {
            const results = await Promise.allSettled([
              Promise.resolve().then(() => hostProbeFactory({ connectionConfig })()),
              Promise.resolve().then(() => readinessProbeFactory({ containerId,
                user: readCheckoutProperty(connectionConfig, 'user'), database: readCheckoutProperty(connectionConfig, 'database') })()),
            ]);
            host = results[0].status === 'fulfilled' ? results[0].value : { outcome: 'failed', error: results[0].reason };
            readiness = results[1].status === 'fulfilled' ? results[1].value : { outcome: 'failed', error: results[1].reason };
          }
          const ended = clock();
          const record = buildPostgresFailureRecord({ correlationId, source, phase, error, host, readiness,
            durationMs: started !== null && ended !== null ? ended - started : null });
          try { Promise.resolve(onRecord(record)).catch(() => {}); } catch { /* Preserve the original failure. */ }
        }).then(completion.resolve, () => completion.resolve());
        return capturing;
      };
    },
  };
}

/** Capture before the owning operation unwinds, without replacing its exact error. */
export async function observePostgresFixtureFailure(captureServerFailure, phase, operation) {
  try { return await operation(); }
  catch (error) {
    try { await captureServerFailure?.(error, phase); } catch { /* Optional evidence must not replace work. */ }
    throw error;
  }
}
