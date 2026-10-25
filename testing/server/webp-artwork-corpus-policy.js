/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { webpArtworkInputs } from './webp-artwork-corpus.js';

export const webpCorpusScreeningLimits = Object.freeze({ maxSizeRatio: 1.10, maxPsnrDropDb: 0.25,
  maxAdditionalChannelError: 8, maxSampleTimeRatio: 1.10, maxOverallTimeRatio: 0.90 });
export const webpCorpusSchedule = Object.freeze(webpArtworkInputs.flatMap((input, index) => [1, 2, 3].flatMap(repetition =>
  ((index + repetition) % 2 ? [2, 4] : [4, 2]).map(effort => Object.freeze({ scope: input.id, effort, repetition,
    runId: `${input.id}-effort-${effort}-r${repetition}` })))));
const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2; };
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function validMetric(metric) {
  return metric && finite(metric.mseRgb) && Number.isSafeInteger(metric.maxAbsoluteError) && metric.maxAbsoluteError >= 0 && metric.maxAbsoluteError <= 255
    && typeof metric.identical === 'boolean' && (metric.identical ? metric.mseRgb === 0 && metric.psnrRgbDb === null
      : metric.mseRgb > 0 && finite(metric.psnrRgbDb));
}

/** Predeclared engineering screen only; visual/human acceptance is independent. */
export function evaluateWebpArtworkCorpus(rows) {
  if (!Array.isArray(rows) || rows.length !== webpCorpusSchedule.length) throw new TypeError('Require the complete fixed corpus schedule');
  const byRun = new Map();
  for (const row of rows) {
    if (!row || !webpCorpusSchedule.some(spec => spec.runId === row.runId && spec.scope === row.scope && spec.effort === row.effort && spec.repetition === row.repetition)
      || byRun.has(row.runId) || !['encoded', 'encoder-failed', 'deadline'].includes(row.outcome)) throw new TypeError('Invalid, duplicate or unknown corpus observation');
    if (row.outcome === 'encoded' && (!finite(row.encodeMs) || row.encodeMs === 0 || !Number.isSafeInteger(row.outputBytes) || row.outputBytes < 1 || row.outputBytes > 100 * 1024 ** 2
      || !/^[a-f0-9]{64}$/u.test(row.outputSha256) || !validMetric(row.metrics))) throw new TypeError('Require actual output, rewrite and RGB metrics');
    byRun.set(row.runId, row);
  }
  const samples = webpArtworkInputs.map(input => {
    const methods = [2, 4].map(effort => rows.filter(row => row.scope === input.id && row.effort === effort));
    if (methods.some(method => method.some(row => row.outcome !== 'encoded'))) return { scope: input.id, passed: false, reasons: ['missing-encoded-reference'] };
    if (methods.some(method => new Set(method.map(row => `${row.outputSha256}:${row.outputBytes}:${JSON.stringify(row.metrics)}`)).size !== 1)) return { scope: input.id, passed: false, reasons: ['non-deterministic-output-or-metrics'] };
    const [candidate, baseline] = methods.map(method => method[0]); const limits = webpCorpusScreeningLimits;
    const sizeRatio = candidate.outputBytes / baseline.outputBytes;
    const timeRatio = median(methods[0].map(row => row.encodeMs)) / median(methods[1].map(row => row.encodeMs));
    const psnrPassed = candidate.metrics.identical || (!baseline.metrics.identical && baseline.metrics.psnrRgbDb - candidate.metrics.psnrRgbDb <= limits.maxPsnrDropDb);
    const reasons = [];
    if (sizeRatio > limits.maxSizeRatio) reasons.push('output-size');
    if (!psnrPassed) reasons.push('rgb-psnr');
    if (candidate.metrics.maxAbsoluteError - baseline.metrics.maxAbsoluteError > limits.maxAdditionalChannelError) reasons.push('maximum-channel-error');
    if (timeRatio > limits.maxSampleTimeRatio) reasons.push('sample-rewrite-time');
    return { scope: input.id, passed: reasons.length === 0, reasons, sizeRatio, timeRatio, candidateMedianMs: median(methods[0].map(row => row.encodeMs)), baselineMedianMs: median(methods[1].map(row => row.encodeMs)) };
  });
  const overallTimeRatio = samples.every(row => finite(row.timeRatio)) ? median(samples.map(row => row.timeRatio)) : null;
  return { limits: webpCorpusScreeningLimits, samples, overallTimeRatio,
    screeningPassed: samples.every(row => row.passed) && overallTimeRatio !== null && overallTimeRatio <= webpCorpusScreeningLimits.maxOverallTimeRatio,
    productionSwitchQualified: false, humanVisualReviewRequired: true };
}
