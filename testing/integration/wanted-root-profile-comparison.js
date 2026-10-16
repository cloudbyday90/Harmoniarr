/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';

export const wantedRootProfileCandidates = Object.freeze([1, 8, 24]);
export const wantedRootProfileMedia = Object.freeze(['sine', 'noise']);
export const wantedRootProfilePairs = Object.freeze([1, 2, 4]);

export function assertWantedRootProfileOptions({ profiles, receiptCandidates, pairs }) {
  const allowed = (values, choices) => Array.isArray(values) && values.length > 0 && values.length <= choices.length
    && new Set(values).size === values.length && Array.from(values).every(value => choices.includes(value));
  if (!allowed(profiles, wantedRootProfileMedia) || !allowed(receiptCandidates, wantedRootProfileCandidates)
    || !wantedRootProfilePairs.includes(pairs)) throw new TypeError('Invalid root lookup profile');
}

/** Keep the full projections private; only a proved pair may publish numeric summaries. */
export function compareWantedRootProfilePair({ legacy, joined }, { receiptCandidates, fileSizes }) {
  assert.ok(wantedRootProfileCandidates.includes(receiptCandidates));
  assert.equal(Array.isArray(fileSizes) && fileSizes.length === 2
    && Array.from(fileSizes).every(size => Number.isSafeInteger(size) && size > 0), true);
  for (const result of [legacy, joined]) {
    const record = result.diagnostics;
    assert.equal(record.counters.fingerprintCalls, receiptCandidates * 2);
    assert.equal(record.counters.availableReceipts, receiptCandidates * 2);
    assert.equal(record.counters.hashedBytes, fileSizes.reduce((sum, size) => sum + size, 0) * receiptCandidates);
    assert.equal(record.phases.root_resolution.calls, receiptCandidates * 2);
    assert.deepEqual(result.projection.wantedReleases, []);
  }
  assert.deepEqual(joined.projection, legacy.projection);
  assert.equal(legacy.queryCount - joined.queryCount, receiptCandidates * 2);
}
