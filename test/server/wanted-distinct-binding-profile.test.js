/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertWantedDistinctFixtureOptions, assertWantedDistinctWorkloadOptions } from '../../testing/integration/wanted-distinct-binding-policy.js';

const defaults = { profiles: ['sine', 'noise'], bindingCounts: [2, 4, 8], pairs: 2,
  gc: () => {}, onProgress: () => {}, onSample: () => {} };

test('distinct-binding policy refuses unsupported, sparse, duplicate and incompatible dimensions', () => {
  for (const options of [{ bindingCounts: [16] }, { bindingCounts: [2, 2] }, { bindingCounts: new Array(1) },
    { bindingCounts: [] }, { profiles: ['private'] }, { profiles: new Array(1) }, { profiles: ['sine', 'sine'] },
    { pairs: 0 }, { gc: null }, { onSample: null }]) {
    assert.throws(() => assertWantedDistinctWorkloadOptions({ ...defaults, ...options }), TypeError);
  }
  assert.throws(() => assertWantedDistinctFixtureOptions({ bindings: 4, mediaProfile: 'noise', durationSeconds: 2 }), TypeError);
});

for (const failure of [new Error('Original cancelled profile'), null]) {
  test(`cancelled distinct-binding policy retains original ${failure === null ? 'null' : 'Error'}`, () => {
    const controller = new AbortController(); controller.abort(failure);
    assert.throws(() => assertWantedDistinctWorkloadOptions({ ...defaults, signal: controller.signal }), error => error === failure);
  });
}
