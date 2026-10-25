/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { webpArtworkInputs } from '../../testing/server/webp-artwork-corpus.js';
import { webpLosslessCases, webpLosslessSchedule, selectWebpRewriteCase } from '../../testing/server/webp-lossless-cases.js';
import { evaluateWebpLosslessRewrite } from '../../testing/server/webp-lossless-qualification.js';
import { compareWebpEffort } from '../../testing/server/webp-effort-comparison.js';
const observations = () => webpLosslessSchedule.map(spec => {
  const input = webpArtworkInputs.find(row => row.id === spec.scope); const facts = { encoding: 'lossless', width: input.width, height: input.height, alphaHint: false, bitstreamDecoded: false };
  return { ...spec, outcome: 'encoded', encodeMs: 100, outputBytes: spec.mode === 'lossless' ? 500 : 1000, outputSha256: (spec.mode === 'lossless' ? 'a' : 'b').repeat(64),
    metrics: { samples: input.width * input.height * 3, pixels: input.width * input.height, sumSquaredError: 0, mseRgb: 0, psnrRgbDb: null, identical: true, maxAbsoluteError: 0 },
    inputFacts: { ...facts, hasExif: true }, outputFacts: { ...facts, extended: false, chunks: ['VP8L'], hasExif: false, hasIcc: false, hasXmp: false } };
});
test('lossless candidates reuse pinned inputs and preserve legacy default modes', () => {
  assert.equal(webpLosslessCases.length, 4); assert.equal(webpLosslessSchedule.length, 24);
  for (const spec of webpLosslessCases) { assert.equal(selectWebpRewriteCase(4, spec.scope, 'lossless'), spec); assert.ok(Object.isFrozen(spec)); assert.equal(spec.input, webpArtworkInputs.find(input => input.id === spec.scope)); }
  assert.equal(selectWebpRewriteCase(2, 'full').quality, 90);
});
test('unknown modes, forged scopes and unsupported lossless efforts cannot spawn', async () => {
  for (const [effort, scope, mode] of [[2, 'cover-type', 'lossless'], ['4', 'cover-type', 'lossless'], [4, 'full', 'lossless'], [4, '../cover-type', 'lossless'], [4, 'cover-type', '--lossless'], [4, 'cover-type', null]]) {
    await assert.rejects(compareWebpEffort({ buffer: Buffer.from('input'), effort, scope, mode }, { spawnFn: () => assert.fail('No spawn') }), TypeError);
  }
});
test('exact sanitized samples pass the engineering screen without granting production authority', () => {
  const result = evaluateWebpLosslessRewrite(observations()); assert.equal(result.allSamplesPassed, true); assert.equal(result.productionSwitchQualified, false);
});
test('size and latency boundaries remain inclusive and regressions stay per sample', () => {
  const rows = observations(); for (const row of rows.filter(item => item.mode === 'lossless')) { row.outputBytes = 1000; row.encodeMs = 1000; }
  assert.equal(evaluateWebpLosslessRewrite(rows).allSamplesPassed, true);
  for (const row of rows.filter(item => item.mode === 'lossless' && item.scope === 'cover-type')) { row.outputBytes++; row.encodeMs++; }
  const result = evaluateWebpLosslessRewrite(rows); assert.equal(result.allSamplesPassed, false); assert.deepEqual(result.samples.find(row => row.scope === 'cover-type').reasons, ['output-size', 'rewrite-latency']);
});
test('pixel inequality, retained metadata and input passthrough cannot qualify lossless rewriting', () => {
  const rows = observations(); for (const row of rows.filter(item => item.mode === 'lossless')) { row.metrics = { ...row.metrics, identical: false, sumSquaredError: row.metrics.samples, mseRgb: 1, maxAbsoluteError: 1, psnrRgbDb: 48.1308 }; row.outputFacts.hasExif = true; row.outputSha256 = webpArtworkInputs.find(input => input.id === row.scope).sha256; }
  assert.ok(evaluateWebpLosslessRewrite(rows).samples.every(row => row.reasons.includes('decoded-pixel-inequality') && row.reasons.includes('container-facts') && row.reasons.includes('input-passthrough')));
  const missing = observations(); for (const row of missing.filter(item => item.mode === 'lossless')) delete row.outputFacts.hasIcc;
  assert.ok(evaluateWebpLosslessRewrite(missing).samples.every(row => row.reasons.includes('container-facts')), 'Unavailable metadata evidence is not false');
});
test('failed and nondeterministic encodes remain explicit observations', () => {
  const failed = observations(); failed[0].outcome = 'deadline'; assert.deepEqual(evaluateWebpLosslessRewrite(failed).samples[0].reasons, ['missing-encoded-reference']);
  const changed = observations(); changed[0].outputSha256 = 'c'.repeat(64); assert.deepEqual(evaluateWebpLosslessRewrite(changed).samples[0].reasons, ['non-deterministic-output-or-metrics']);
});
test('incomplete, duplicate, forged, nonfinite and inconsistent equality evidence is refused', () => {
  assert.throws(() => evaluateWebpLosslessRewrite([]), TypeError);
  for (const change of [rows => { rows[0] = rows[1]; }, rows => { rows[0].mode = 'unknown'; }, rows => { rows[0].encodeMs = Infinity; }, rows => { rows[0].metrics.samples = 3; }, rows => { rows[0].metrics.psnrRgbDb = Infinity; }, rows => { rows[0].metrics.maxAbsoluteError = 1; }]) { const rows = observations(); change(rows); assert.throws(() => evaluateWebpLosslessRewrite(rows), TypeError); }
});
