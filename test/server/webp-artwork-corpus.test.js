/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { webpArtworkInputs, webpArtworkCases } from '../../testing/server/webp-artwork-corpus.js';
import { webpCorpusSchedule, evaluateWebpArtworkCorpus } from '../../testing/server/webp-artwork-corpus-policy.js';
import { selectWebpEffortCase } from '../../testing/server/webp-effort-cases.js';
import { compareWebpEffort } from '../../testing/server/webp-effort-comparison.js';
import { createWebpCorpusPixels } from '../../testing/server/webp-artwork-corpus-pixels.js';
import { prepareWebpArtworkCorpus } from '../../testing/server/webp-artwork-corpus-preparation.js';
const metrics = () => ({ mseRgb: 6.5025, psnrRgbDb: 40, maxAbsoluteError: 10, identical: false });
const observations = () => webpCorpusSchedule.map(spec => ({ ...spec, outcome: 'encoded', encodeMs: spec.effort === 2 ? 80 : 100,
  outputBytes: 1000, outputSha256: String(spec.effort).repeat(64), metrics: metrics() }));

test('corpus selectors pin provenance and immutable inputs without replacing the original comparison', () => {
  assert.equal(webpArtworkInputs.length, 4); assert.equal(webpArtworkCases.length, 8);
  for (const spec of webpArtworkCases) { assert.equal(selectWebpEffortCase(spec.effort, spec.scope), spec); assert.ok(Object.isFrozen(spec) && Object.isFrozen(spec.input)); assert.equal(spec.quality, 90); assert.match(spec.input.sha256, /^[a-f0-9]{64}$/u); }
  assert.equal(selectWebpEffortCase(4, 'full').width, 7120);
  assert.equal(webpArtworkInputs.filter(input => input.source).length, 2);
  for (const input of webpArtworkInputs.filter(item => item.source)) { assert.ok(Object.isFrozen(input.source)); assert.equal(new URL(input.source.url).protocol, 'https:'); }
});
test('fixed schedule has three paired repetitions per sample and alternates method order', () => {
  assert.equal(webpCorpusSchedule.length, 24); assert.equal(new Set(webpCorpusSchedule.map(row => row.runId)).size, 24);
  for (const input of webpArtworkInputs) { const selected = webpCorpusSchedule.filter(row => row.scope === input.id); assert.equal(selected.length, 6); assert.notEqual(selected[0].effort, selected[2].effort); assert.equal(selected[0].effort, selected[4].effort); }
});
test('invalid selectors and preparation paths fail before encoding or writing', async () => {
  await assert.rejects(compareWebpEffort({ buffer: Buffer.from('input'), effort: 2, scope: '../photo-earth' }, { spawnFn: () => assert.fail('No spawn') }), TypeError);
  await assert.rejects(prepareWebpArtworkCorpus({ root: 'relative', sourcesRoot: 'relative' }), TypeError);
  assert.throws(() => createWebpCorpusPixels('unknown'), TypeError);
});
test('a passing engineering screen cannot grant production or human visual acceptance', () => {
  const result = evaluateWebpArtworkCorpus(observations()); assert.equal(result.screeningPassed, true); assert.equal(result.overallTimeRatio, 0.8);
  assert.equal(result.productionSwitchQualified, false); assert.equal(result.humanVisualReviewRequired, true);
});
test('individual size, PSNR, maximum-error and time regressions remain explicit', () => {
  for (const [change, reason] of [[row => { row.outputBytes = 1101; }, 'output-size'], [row => { row.metrics.psnrRgbDb = 39.749; }, 'rgb-psnr'], [row => { row.metrics.maxAbsoluteError = 19; }, 'maximum-channel-error'], [row => { row.encodeMs = 111; }, 'sample-rewrite-time']]) {
    const rows = observations(); for (const row of rows.filter(item => item.scope === 'photo-earth' && item.effort === 2)) change(row);
    const result = evaluateWebpArtworkCorpus(rows); assert.equal(result.screeningPassed, false); assert.ok(result.samples[0].reasons.includes(reason));
  }
});
test('inclusive per-sample boundaries pass while insufficient aggregate speed fails', () => {
  const rows = observations(); for (const row of rows.filter(item => item.effort === 2)) { row.outputBytes = 1100; row.metrics.psnrRgbDb = 39.75; row.metrics.maxAbsoluteError = 18; row.encodeMs = 91; }
  const result = evaluateWebpArtworkCorpus(rows); assert.ok(result.samples.every(row => row.passed)); assert.equal(result.screeningPassed, false);
});
test('identical baselines require identical candidates with JSON-safe infinite PSNR', () => {
  const rows = observations(); for (const row of rows) if (row.effort === 4) row.metrics = { mseRgb: 0, psnrRgbDb: null, maxAbsoluteError: 0, identical: true };
  assert.ok(evaluateWebpArtworkCorpus(rows).samples.every(row => row.reasons.includes('rgb-psnr')));
  for (const row of rows) row.metrics = { mseRgb: 0, psnrRgbDb: null, maxAbsoluteError: 0, identical: true };
  assert.equal(evaluateWebpArtworkCorpus(rows).screeningPassed, true);
});
test('missing encodes and inconsistent repeated outputs cannot qualify a sample', () => {
  const rows = observations(); rows[0].outcome = 'encoder-failed'; assert.equal(evaluateWebpArtworkCorpus(rows).samples[0].reasons[0], 'missing-encoded-reference');
  const changed = observations(); changed[0].outputSha256 = 'a'.repeat(64); assert.equal(evaluateWebpArtworkCorpus(changed).samples[0].reasons[0], 'non-deterministic-output-or-metrics');
});
test('incomplete, duplicate, forged and nonfinite observations are refused', () => {
  assert.throws(() => evaluateWebpArtworkCorpus([]), TypeError);
  for (const change of [rows => { rows[0] = rows[1]; }, rows => { rows[0].scope = '../photo-earth'; }, rows => { rows[0].encodeMs = Infinity; }, rows => { rows[0].metrics.psnrRgbDb = NaN; }]) { const rows = observations(); change(rows); assert.throws(() => evaluateWebpArtworkCorpus(rows), TypeError); }
});
