/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { webpArtworkInputs } from './webp-artwork-corpus.js';
import { webpLosslessSchedule } from './webp-lossless-cases.js';
export const webpLosslessLimits = Object.freeze({ maxSizeRatio: 1, maxMedianRewriteMs: 1000 });
const median = rows => [...rows].map(row => row.encodeMs).sort((a, b) => a - b)[1];
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const equalPixels = metrics => metrics.identical && metrics.mseRgb === 0 && metrics.sumSquaredError === 0 && metrics.maxAbsoluteError === 0;
function factsMatch(facts, input, output) {
  return facts?.encoding === 'lossless' && facts.width === input.width && facts.height === input.height && facts.alphaHint === false
    && facts.bitstreamDecoded === false && (output ? facts.extended === false && JSON.stringify(facts.chunks) === '["VP8L"]'
      && facts.hasExif === false && facts.hasIcc === false && facts.hasXmp === false : facts.hasExif === true);
}
/** Per-sample evidence screen; never a production encoder selector. */
export function evaluateWebpLosslessRewrite(rows) {
  if (!Array.isArray(rows) || rows.length !== webpLosslessSchedule.length) throw new TypeError('Require the complete lossless rewrite schedule');
  const seen = new Set();
  for (const row of rows) {
    if (!row || seen.has(row.runId) || !webpLosslessSchedule.some(spec => ['runId', 'scope', 'effort', 'mode', 'repetition'].every(key => row[key] === spec[key]))
      || !['encoded', 'encoder-failed', 'deadline'].includes(row.outcome)) throw new TypeError('Invalid or duplicate rewrite observation');
    seen.add(row.runId); const input = webpArtworkInputs.find(spec => spec.id === row.scope); const metric = row.metrics;
    if (row.outcome === 'encoded' && (!finite(row.encodeMs) || row.encodeMs === 0 || !Number.isSafeInteger(row.outputBytes) || row.outputBytes < 1 || row.outputBytes > 100 * 1024 ** 2
      || !/^[a-f0-9]{64}$/u.test(row.outputSha256) || !metric || metric.samples !== input.width * input.height * 3 || metric.pixels !== input.width * input.height
      || !finite(metric.mseRgb) || !Number.isSafeInteger(metric.sumSquaredError) || metric.sumSquaredError < 0 || !Number.isInteger(metric.maxAbsoluteError) || metric.maxAbsoluteError < 0 || metric.maxAbsoluteError > 255
      || typeof metric.identical !== 'boolean' || (metric.identical ? metric.psnrRgbDb !== null || !equalPixels(metric) : metric.mseRgb === 0 || !finite(metric.psnrRgbDb)))) throw new TypeError('Require bounded measured rewrite/pixel observations');
  }
  const samples = webpArtworkInputs.map(input => {
    const baseline = rows.filter(row => row.scope === input.id && row.mode === 'lossy'); const candidate = rows.filter(row => row.scope === input.id && row.mode === 'lossless');
    if ([...baseline, ...candidate].some(row => row.outcome !== 'encoded')) return { scope: input.id, passed: false, reasons: ['missing-encoded-reference'] };
    if ([baseline, candidate].some(method => new Set(method.map(row => `${row.outputSha256}:${row.outputBytes}:${JSON.stringify(row.metrics)}`)).size !== 1)) return { scope: input.id, passed: false, reasons: ['non-deterministic-output-or-metrics'] };
    const reasons = []; const sizeRatio = candidate[0].outputBytes / baseline[0].outputBytes; const candidateMedianMs = median(candidate);
    if (!candidate.every(row => equalPixels(row.metrics))) reasons.push('decoded-pixel-inequality');
    if (!candidate.every(row => factsMatch(row.inputFacts, input, false) && factsMatch(row.outputFacts, input, true))) reasons.push('container-facts');
    if (candidate.some(row => row.outputSha256 === input.sha256)) reasons.push('input-passthrough');
    if (sizeRatio > webpLosslessLimits.maxSizeRatio) reasons.push('output-size');
    if (candidateMedianMs > webpLosslessLimits.maxMedianRewriteMs) reasons.push('rewrite-latency');
    return { scope: input.id, passed: reasons.length === 0, reasons, sizeRatio, candidateMedianMs, baselineMedianMs: median(baseline), candidateBytes: candidate[0].outputBytes, baselineBytes: baseline[0].outputBytes, pixelEquality: candidate.every(row => equalPixels(row.metrics)) };
  });
  return { limits: webpLosslessLimits, samples, allSamplesPassed: samples.every(row => row.passed), productionSwitchQualified: false };
}
