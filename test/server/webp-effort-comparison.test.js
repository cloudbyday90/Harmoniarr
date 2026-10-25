/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { webpEffortCases, webpEffortInput, selectWebpEffortCase } from '../../testing/server/webp-effort-cases.js';
import { compareWebpEffort } from '../../testing/server/webp-effort-comparison.js';
import { measureRgb8Error } from '../../testing/server/webp-quality-metrics.js';

test('fixed comparison cases preserve the pinned input and independent full/crop scopes', () => {
  assert.equal(webpEffortCases.length, 4); assert.equal(webpEffortInput.inputBytes, 10675042);
  for (const spec of webpEffortCases) {
    assert.equal(selectWebpEffortCase(spec.effort, spec.scope), spec); assert.equal(spec.quality, 90); assert.ok(Object.isFrozen(spec));
    if (spec.crop) { assert.equal(spec.crop.left * 2 + spec.width, webpEffortInput.width); assert.equal(spec.crop.top * 2 + spec.height, webpEffortInput.height); assert.ok(Object.isFrozen(spec.crop)); }
    else assert.equal(spec.width, webpEffortInput.width);
  }
});

test('unknown effort/scope selectors cannot launch an encoder or inject arguments', async () => {
  for (const [effort, scope] of [[0, 'full'], [3, 'full'], ['2', 'full'], [2, '../full'], [4, null]]) {
    assert.throws(() => selectWebpEffortCase(effort, scope), TypeError);
    await assert.rejects(compareWebpEffort({ buffer: Buffer.from('input'), effort, scope }, { spawnFn: () => assert.fail('No spawn') }), TypeError);
  }
});

test('exact RGB8 equality reports infinite PSNR explicitly without nonfinite JSON numbers', () => {
  const result = measureRgb8Error(Buffer.from([0, 127, 255]), Buffer.from([0, 127, 255]));
  assert.deepEqual(result, { samples: 3, pixels: 1, sumSquaredError: 0, mseRgb: 0, maxAbsoluteError: 0, identical: true, psnrRgbDb: null });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

test('RGB8 error uses every channel with the expected mean-square and decibel scale', () => {
  const result = measureRgb8Error(Buffer.from([0, 0, 0]), Buffer.from([1, 2, 2]));
  assert.equal(result.sumSquaredError, 9); assert.equal(result.mseRgb, 3); assert.equal(result.maxAbsoluteError, 2);
  assert.equal(result.identical, false); assert.ok(Math.abs(result.psnrRgbDb - 43.35959106148248) < 1e-10);
  assert.equal(measureRgb8Error(Buffer.alloc(3), Buffer.alloc(3, 255)).psnrRgbDb, 0);
});

test('RGB8 metrics refuse empty, misaligned, mismatched and non-Buffer samples', () => {
  for (const [a, b] of [[Buffer.alloc(0), Buffer.alloc(0)], [Buffer.alloc(2), Buffer.alloc(2)], [Buffer.alloc(3), Buffer.alloc(6)], [new Uint8Array(3), Buffer.alloc(3)]]) {
    assert.throws(() => measureRgb8Error(a, b), TypeError);
  }
});
