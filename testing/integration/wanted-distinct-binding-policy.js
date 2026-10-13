/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';

export const wantedDistinctBindingCounts = Object.freeze([2, 4, 8]);
export const wantedDistinctReceiptsPerBinding = 3;

export function assertWantedDistinctWorkloadOptions({ signal, profiles, bindingCounts, pairs, gc, onProgress, onSample }) {
  if (typeof gc !== 'function' || typeof onProgress !== 'function' || typeof onSample !== 'function'
    || ![1, 2].includes(pairs) || !Array.isArray(profiles) || !profiles.length || profiles.length > 2
    || new Set(profiles).size !== profiles.length || [...profiles].some(p => !['sine', 'noise'].includes(p))
    || !Array.isArray(bindingCounts) || !bindingCounts.length || bindingCounts.length > 3
    || new Set(bindingCounts).size !== bindingCounts.length || [...bindingCounts].some(n => !wantedDistinctBindingCounts.includes(n))) {
    throw new TypeError('Invalid distinct-binding workload');
  }
  signal?.throwIfAborted();
}

export function assertWantedDistinctFixtureOptions({ bindings, mediaProfile, durationSeconds }) {
  if (!wantedDistinctBindingCounts.includes(bindings) || !['sine', 'noise'].includes(mediaProfile)
    || durationSeconds !== (mediaProfile === 'noise' ? 30 : 2)) throw new TypeError('Invalid distinct-binding fixture');
}

export function assertWantedDistinctSample(sample, { bindings, fileSizes, projections = bindings + 5 }) {
  const receipts = bindings * wantedDistinctReceiptsPerBinding;
  const { counters, phases, outcome } = sample.diagnostics;
  assert.equal(outcome, 'completed'); assert.equal(counters.projectionReads, projections);
  assert.equal(counters.receiptRows, receipts * projections); assert.equal(counters.eligibleReceipts, receipts * projections);
  assert.equal(counters.availableReceipts, receipts * projections);
  assert.equal(counters.closedReceiptGroups, bindings * projections);
  assert.equal(counters.groupedReceiptRows, receipts * projections);
  assert.equal(counters.receiptGroupingFallbacks, 0); assert.equal(counters.receiptGroupRefusals, 0);
  assert.equal(counters.fingerprintCalls, 2 * bindings * projections);
  assert.equal(counters.hashedBytes, 2 * projections * fileSizes.reduce((sum, size) => sum + size, 0));
  assert.equal(phases.root_resolution.calls, 2 * projections * bindings
    * (sample.rootReadMode === 'member' ? wantedDistinctReceiptsPerBinding : 1));
  assert.equal(sample.pathWork.distinctPrivateBindings, bindings);
  assert.equal(sample.pathWork.distinctPerProjection, bindings * projections);
  assert.equal(sample.pathWork.repeatedWithinProjections, bindings * projections);
  assert.deepEqual(sample.result.wantedKeys, []); assert.equal(sample.memory.unavailable, false);
}
