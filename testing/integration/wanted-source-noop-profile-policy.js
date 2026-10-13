/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { assertWantedDistinctSample } from './wanted-distinct-binding-policy.js';

export function compareWantedSourceNoopSamples(compatibility, locked, { bindings, fileSizes }) {
  assert.equal(compatibility.sourceTransitionMode, 'compatibility'); assert.equal(locked.sourceTransitionMode, 'locked-noop');
  assert.equal(compatibility.rootReadMode, 'bounded'); assert.equal(locked.rootReadMode, 'bounded');
  assertWantedDistinctSample(compatibility, { bindings, fileSizes });
  assertWantedDistinctSample(locked, { bindings, fileSizes, projections: 5 });
  assert.equal(compatibility.diagnostics.counters.sourceNoops, 0);
  assert.equal(compatibility.diagnostics.counters.sourceTransitionAttempts, bindings);
  assert.equal(locked.diagnostics.counters.sourceNoops, bindings);
  assert.equal(locked.diagnostics.counters.sourceTransitionAttempts, 0);
  assert.deepEqual(compatibility.result, locked.result);
  assert.ok(compatibility.durable); assert.deepEqual(compatibility.durable, locked.durable);
  // All retained complete reads must equal the same private projection, despite fewer reads.
  assert.equal(new Set([...compatibility.projectionDigests, ...locked.projectionDigests]).size, 1);
  assert.equal(compatibility.projectionDigests.length, bindings + 5); assert.equal(locked.projectionDigests.length, 5);
}
