/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';
import { createWantedVerificationObserver } from '../../src/server/library/library-wanted-verification-observer.js';
import { fingerprintOperatorTrackFile } from '../../src/server/metadata/operator-track-file-evidence-service.js';
import { resolveOperatorTrackReadMethod, resolveOperatorTrackReadBuffer } from '../../src/server/metadata/operator-track-fingerprint-policy.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';
import { withRollbackFixtureClient } from './fixture-transaction-client.js';
import { createWantedWorkloadMemorySampler } from './wanted-workload-memory.js';
import { createWantedGuardedCostObserver } from './wanted-guarded-cost-observer.js';

/** Complete guarded service work on an active rollback-owned transaction, never a cache. */
export async function profileWantedGuardedReconciliation(pool, { readMethod = 'reusable', signal,
  gc = global.gc, afterProjection = null, receiptGrouping = false, costDiagnostics = false } = {}) {
  readMethod = resolveOperatorTrackReadMethod(readMethod);
  const readBufferBytes = resolveOperatorTrackReadBuffer(undefined, readMethod);
  if (typeof gc !== 'function') throw new TypeError('Guarded workload measurement requires explicit GC');
  if (afterProjection !== null && typeof afterProjection !== 'function') throw new TypeError('Invalid guarded profile hook');
  if (typeof receiptGrouping !== 'boolean') throw new TypeError('Invalid receipt grouping profile');
  if (typeof costDiagnostics !== 'boolean') throw new TypeError('Invalid guarded cost diagnostics');
  signal?.throwIfAborted();
  return withRollbackFixtureClient(pool, async client => {
    let queryCount = 0; let queryMs = 0; let queryActive = false; let record; let distinctPerProjection = 0;
    const allPaths = new Set(); let projectionPaths; const projectionDigests = [];
    const costs = costDiagnostics ? createWantedGuardedCostObserver() : null;
    const queryable = { async query(...args) {
      signal?.throwIfAborted(); assert.equal(queryActive, false, 'Guarded queries must remain serial');
      queryActive = true; queryCount++; const started = performance.now();
      try {
        const work = () => client.query(...args);
        const result = costs ? await costs.query(args[0], work) : await work();
        signal?.throwIfAborted(); return result;
      }
      finally { queryActive = false; queryMs += performance.now() - started; }
    } };
    let memory;
    const reader = createLibraryWantedReleaseReader({ groupReceiptVerification: receiptGrouping, fingerprintTrackFile: async (path, options) => {
      signal?.throwIfAborted(); const binding = JSON.stringify([options.libraryRoot, path]);
      allPaths.add(binding); projectionPaths.add(binding);
      const close = costs?.openWindow('fingerprint');
      try {
        const result = await fingerprintOperatorTrackFile(path, { ...options, readMethod, readBufferBytes,
          onBytesRead: amount => { options.onBytesRead?.(amount); memory.observeBytes(amount); } });
        signal?.throwIfAborted(); return result;
      } finally { close?.(); }
    } });
    const maintenance = createMaintenanceLockService({ getPoolFn: () => queryable });
    const guard = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: maintenance.listActiveMaintenanceLocks });
    const wanted = createLibraryWantedReleaseService({ assertMaintenanceWriteAllowed: guard.assertNoActiveWriteLocks,
      withTransaction: work => work(queryable),
      projectionReader: { readWantedReleaseProjection: async input => {
        projectionPaths = new Set();
        const close = costs?.openWindow('projection'); let result;
        try { result = await reader.readWantedReleaseProjection(input); }
        finally { close?.(); }
        distinctPerProjection += projectionPaths.size;
        const closeDigest = costs?.openWindow('digest');
        try { projectionDigests.push(createHash('sha256').update(JSON.stringify(result)).digest('hex')); }
        finally { closeDigest?.(); }
        await afterProjection?.({ count: projectionDigests.length });
        return result;
      } },
      createVerificationObserver: () => createWantedVerificationObserver({ enabled: true, onRecord: value => { record = value; } }),
    });
    gc(); memory = createWantedWorkloadMemorySampler();
    const started = performance.now(); let result; let observation;
    try { result = await wanted.reconcileWantedReleases(); }
    finally { observation = memory.finish(); }
    return { result, projectionDigests, queryCount, queryMs, readMethod, readBufferBytes, receiptGrouping,
      elapsedMs: performance.now() - started, diagnostics: record, memory: observation,
      costDiagnostics, costs: costs?.snapshot() ?? null,
      pathWork: { distinctPrivateBindings: allPaths.size, distinctPerProjection,
        repeatedWithinProjections: record.counters.fingerprintCalls - distinctPerProjection } };
  });
}

export function compareWantedGuardedSamples(first, second) {
  assert.deepEqual(first.result, second.result); assert.deepEqual(first.projectionDigests, second.projectionDigests);
  assert.equal(first.queryCount, second.queryCount); assert.deepEqual(first.diagnostics.counters, second.diagnostics.counters);
  assert.deepEqual(first.pathWork, second.pathWork);
}

export function summarizeWantedGuardedSample({ readMethod, readBufferBytes, receiptGrouping, costDiagnostics, costs, queryCount, queryMs, elapsedMs,
  memory, pathWork, diagnostics }) {
  return { readMethod, readBufferBytes, receiptGrouping, costDiagnostics, costs, queryCount, queryMs, elapsedMs, memory, pathWork,
    counters: diagnostics.counters, phases: diagnostics.phases };
}

export function compareWantedClosedGroupSamples(serial, grouped) {
  assert.deepEqual(serial.result, grouped.result); assert.deepEqual(serial.projectionDigests, grouped.projectionDigests);
  for (const name of ['projectionReads', 'receiptRows', 'eligibleReceipts', 'availableReceipts']) {
    assert.equal(serial.diagnostics.counters[name], grouped.diagnostics.counters[name]);
  }
  assert.equal(grouped.diagnostics.counters.groupedReceiptRows, serial.diagnostics.counters.eligibleReceipts);
  assert.equal(grouped.diagnostics.counters.fingerprintCalls, grouped.diagnostics.counters.closedReceiptGroups * 2);
  assert.equal(grouped.queryCount - serial.queryCount, grouped.diagnostics.counters.groupedReceiptRows);
  assert.equal(grouped.pathWork.distinctPerProjection, serial.pathWork.distinctPerProjection);
}
