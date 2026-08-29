/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  assertBrowserTestEvidenceContract,
  resolveBrowserTestEvidencePath,
} from './browser-test-evidence.js';

export const browserTestEvidenceReviewInputPathEnvVar = 'HARMONIARR_BROWSER_TEST_EVIDENCE_REVIEW_INPUT_PATH';
export const browserTestEvidenceReviewOutputPathEnvVar = 'HARMONIARR_BROWSER_TEST_EVIDENCE_REVIEW_OUTPUT_PATH';
export const browserTestEvidenceReviewRequiredSampleCount = 10;
export const browserTestEvidenceReviewSchemaVersion = 1;

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertOnlyAllowedFields(value, allowedFields, label) {
  assertObject(value, label);

  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      throw new Error(`${label}.${field} is not allowed`);
    }
  }
}

function assertPositiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function assertIsoTimestamp(value, label) {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
    || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
}

function getNearestRank(values, percentile) {
  const sortedValues = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sortedValues.length * percentile) - 1);

  return sortedValues[index];
}

function getMedian(values) {
  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);

  return sortedValues.length % 2 === 0
    ? (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2
    : sortedValues[middleIndex];
}

function summarizeDurations(samples) {
  const durations = samples.map(({ evidence }) => evidence.browserTest.durationMs);

  if (durations.length === 0) {
    return null;
  }

  return {
    maximum: Math.max(...durations),
    median: getMedian(durations),
    minimum: Math.min(...durations),
    p95: getNearestRank(durations, 0.95),
  };
}

function collectRunIds(samples, predicate) {
  return samples.filter(predicate).map(({ runId }) => runId);
}

function createFindings(samples) {
  const findings = [];

  if (samples.length < browserTestEvidenceReviewRequiredSampleCount) {
    findings.push({
      code: 'sample_count_shortfall',
      receivedSampleCount: samples.length,
      requiredSampleCount: browserTestEvidenceReviewRequiredSampleCount,
    });
  }

  if (samples.length > browserTestEvidenceReviewRequiredSampleCount) {
    findings.push({
      code: 'sample_count_exceeded',
      receivedSampleCount: samples.length,
      requiredSampleCount: browserTestEvidenceReviewRequiredSampleCount,
    });
  }

  const failedRunIds = collectRunIds(samples, ({ evidence }) => evidence.browserTest.status !== 'passed');
  if (failedRunIds.length > 0) {
    findings.push({ code: 'browser_test_failed', runIds: failedRunIds });
  }

  const cleanupRunIds = collectRunIds(samples, ({ evidence }) => evidence.cleanup.status !== 'clean');
  if (cleanupRunIds.length > 0) {
    findings.push({ code: 'cleanup_not_clean', runIds: cleanupRunIds });
  }

  const workerCountRunIds = collectRunIds(samples, ({ evidence }) => evidence.browserTest.workerCount !== 2);
  if (workerCountRunIds.length > 0) {
    findings.push({ code: 'worker_count_changed', runIds: workerCountRunIds });
  }

  return findings;
}

function getReviewStatus(findings) {
  if (findings.length === 0) {
    return 'baseline_confirmed';
  }

  return findings.every(({ code }) => code === 'sample_count_shortfall')
    ? 'incomplete'
    : 'review_required';
}

function createSample(sample, index, runIds) {
  const label = `browser test evidence review input.samples[${index}]`;
  assertOnlyAllowedFields(sample, new Set(['evidence', 'runId']), label);
  assertPositiveSafeInteger(sample.runId, `${label}.runId`);

  if (runIds.has(sample.runId)) {
    throw new Error(`${label}.runId must be unique`);
  }

  runIds.add(sample.runId);

  return {
    evidence: assertBrowserTestEvidenceContract(sample.evidence),
    runId: sample.runId,
  };
}

function summarizeSample({ evidence, runId }) {
  return {
    browserTest: { ...evidence.browserTest },
    cleanup: { ...evidence.cleanup },
    generatedAt: evidence.generatedAt,
    runId,
  };
}

export function createBrowserTestEvidenceReviewInput({ samples, schemaVersion } = {}) {
  if (schemaVersion !== browserTestEvidenceReviewSchemaVersion) {
    throw new Error(`browser test evidence review input.schemaVersion must equal ${browserTestEvidenceReviewSchemaVersion}`);
  }

  if (!Array.isArray(samples)) {
    throw new Error('browser test evidence review input.samples must be an array');
  }

  const runIds = new Set();

  return {
    samples: samples.map((sample, index) => createSample(sample, index, runIds)),
    schemaVersion: browserTestEvidenceReviewSchemaVersion,
  };
}

export function assertBrowserTestEvidenceReviewInputContract(input) {
  assertOnlyAllowedFields(input, new Set(['samples', 'schemaVersion']), 'browser test evidence review input');
  return createBrowserTestEvidenceReviewInput(input);
}

export function parseBrowserTestEvidenceReviewInput(text) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('browser test evidence review input text is required');
  }

  try {
    return assertBrowserTestEvidenceReviewInputContract(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('browser test evidence review input must be valid JSON', { cause: error });
    }

    throw error;
  }
}

export function createBrowserTestEvidenceReview({
  generatedAt = new Date().toISOString(),
  samples,
  schemaVersion = browserTestEvidenceReviewSchemaVersion,
} = {}) {
  const input = createBrowserTestEvidenceReviewInput({ samples, schemaVersion });
  assertIsoTimestamp(generatedAt, 'browser test evidence review.generatedAt');

  const findings = createFindings(input.samples);

  return {
    durationMs: summarizeDurations(input.samples),
    findings,
    generatedAt,
    requiredSampleCount: browserTestEvidenceReviewRequiredSampleCount,
    sampleCount: input.samples.length,
    samples: input.samples.map(summarizeSample),
    schemaVersion: browserTestEvidenceReviewSchemaVersion,
    status: getReviewStatus(findings),
  };
}

export async function writeBrowserTestEvidenceReview({
  cwd = process.cwd(),
  inputPath,
  mkdirFn = mkdir,
  outputPath,
  readFileFn = readFile,
  writeFileFn = writeFile,
} = {}) {
  const resolvedInputPath = resolveBrowserTestEvidencePath(inputPath, { cwd });
  const resolvedOutputPath = resolveBrowserTestEvidencePath(outputPath, { cwd });

  if (resolvedInputPath === resolvedOutputPath) {
    throw new Error('browser test evidence review input and output paths must differ');
  }

  const input = parseBrowserTestEvidenceReviewInput(await readFileFn(resolvedInputPath, 'utf8'));
  const review = createBrowserTestEvidenceReview(input);

  await mkdirFn(dirname(resolvedOutputPath), { recursive: true });
  await writeFileFn(resolvedOutputPath, `${JSON.stringify(review, null, 2)}\n`, 'utf8');

  return {
    outputPath: resolvedOutputPath,
    review,
  };
}

function formatDuration(durationMs) {
  return `${(durationMs / 1_000).toFixed(1)} seconds`;
}

function formatStatus(status) {
  return status.split('_').map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(' ');
}

function formatFinding(finding) {
  switch (finding.code) {
    case 'sample_count_shortfall':
      return `${finding.receivedSampleCount} of ${finding.requiredSampleCount} required samples are available.`;
    case 'sample_count_exceeded':
      return `${finding.receivedSampleCount} samples were supplied; review exactly ${finding.requiredSampleCount}.`;
    case 'browser_test_failed':
      return `Browser tests did not pass for run IDs: ${finding.runIds.join(', ')}.`;
    case 'cleanup_not_clean':
      return `Cleanup was not clean for run IDs: ${finding.runIds.join(', ')}.`;
    default:
      return `Worker count changed for run IDs: ${finding.runIds.join(', ')}.`;
  }
}

export function renderBrowserTestEvidenceReviewSummary(review) {
  const durationSummary = review.durationMs
    ? `Minimum ${formatDuration(review.durationMs.minimum)}; median ${formatDuration(review.durationMs.median)}; p95 ${formatDuration(review.durationMs.p95)}; maximum ${formatDuration(review.durationMs.maximum)}.`
    : 'No duration statistics are available yet.';
  const findings = review.findings.length === 0
    ? ['No discrepancies were found.']
    : review.findings.map(formatFinding);

  return [
    '### Browser Validation evidence review',
    '',
    `- Result: **${formatStatus(review.status)}**`,
    `- Samples: **${review.sampleCount}/${review.requiredSampleCount}**`,
    `- Duration (descriptive): ${durationSummary}`,
    `- Run IDs: ${review.samples.length === 0 ? 'none' : review.samples.map(({ runId }) => runId).join(', ')}`,
    ...findings.map((finding) => `- Finding: ${finding}`),
    '',
  ].join('\n');
}
