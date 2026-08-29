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
export const browserTestEvidenceReviewSchemaVersion = 2;

const supportedBrowserTestEvidenceReviewSchemaVersions = new Set([1, browserTestEvidenceReviewSchemaVersion]);
const terminalWorkflowConclusions = new Set([
  'action_required',
  'cancelled',
  'failure',
  'neutral',
  'skipped',
  'stale',
  'success',
  'timed_out',
]);

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

function assertWorkflowRun(workflowRun, label) {
  assertOnlyAllowedFields(workflowRun, new Set([
    'completedAt',
    'conclusion',
    'event',
    'headBranch',
    'headSha',
    'startedAt',
  ]), label);
  assertIsoTimestamp(workflowRun.startedAt, `${label}.startedAt`);
  assertIsoTimestamp(workflowRun.completedAt, `${label}.completedAt`);

  if (Date.parse(workflowRun.completedAt) < Date.parse(workflowRun.startedAt)) {
    throw new Error(`${label}.completedAt must not precede ${label}.startedAt`);
  }

  if (!terminalWorkflowConclusions.has(workflowRun.conclusion)) {
    throw new Error(`${label}.conclusion must be a supported terminal GitHub Actions conclusion`);
  }

  if (workflowRun.event !== 'workflow_dispatch') {
    throw new Error(`${label}.event must equal "workflow_dispatch"`);
  }

  if (workflowRun.headBranch !== 'main') {
    throw new Error(`${label}.headBranch must equal "main"`);
  }

  if (typeof workflowRun.headSha !== 'string' || !/^[a-f0-9]{40}$/u.test(workflowRun.headSha)) {
    throw new Error(`${label}.headSha must be a lowercase 40-character Git SHA`);
  }

  return { ...workflowRun };
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
  const durations = samples
    .filter(({ evidence }) => evidence !== null)
    .map(({ evidence }) => evidence.browserTest.durationMs);

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

  const headShas = [...new Set(samples.map(({ workflowRun }) => workflowRun.headSha))];
  if (headShas.length > 1) {
    findings.push({ code: 'source_commit_changed', headShas });
  }

  const chronologicalSamples = [...samples].sort((left, right) => {
    return Date.parse(left.workflowRun.startedAt) - Date.parse(right.workflowRun.startedAt);
  });
  const overlappingRunIds = [];
  let activeSample = chronologicalSamples[0] ?? null;

  for (let index = 1; index < chronologicalSamples.length; index += 1) {
    const sample = chronologicalSamples[index];

    if (Date.parse(activeSample.workflowRun.completedAt) > Date.parse(sample.workflowRun.startedAt)) {
      overlappingRunIds.push(activeSample.runId, sample.runId);
    }

    if (Date.parse(sample.workflowRun.completedAt) > Date.parse(activeSample.workflowRun.completedAt)) {
      activeSample = sample;
    }
  }

  if (overlappingRunIds.length > 0) {
    findings.push({
      code: 'workflow_runs_overlapped',
      runIds: [...new Set(overlappingRunIds)],
    });
  }

  const evidenceUnavailableRunIds = collectRunIds(samples, ({ evidence }) => evidence === null);
  if (evidenceUnavailableRunIds.length > 0) {
    findings.push({ code: 'browser_test_evidence_unavailable', runIds: evidenceUnavailableRunIds });
  }

  const workflowResultMismatchRunIds = collectRunIds(samples, ({ evidence, workflowRun }) => {
    if (evidence === null) {
      return false;
    }

    return (evidence.browserTest.status === 'passed' && workflowRun.conclusion !== 'success')
      || (evidence.browserTest.status === 'failed' && workflowRun.conclusion === 'success');
  });
  if (workflowResultMismatchRunIds.length > 0) {
    findings.push({ code: 'workflow_result_mismatch', runIds: workflowResultMismatchRunIds });
  }

  const failedRunIds = collectRunIds(samples, ({ evidence }) => evidence !== null && evidence.browserTest.status !== 'passed');
  if (failedRunIds.length > 0) {
    findings.push({ code: 'browser_test_failed', runIds: failedRunIds });
  }

  const cleanupRunIds = collectRunIds(samples, ({ evidence }) => evidence !== null && evidence.cleanup.status !== 'clean');
  if (cleanupRunIds.length > 0) {
    findings.push({ code: 'cleanup_not_clean', runIds: cleanupRunIds });
  }

  const workerCountRunIds = collectRunIds(samples, ({ evidence }) => evidence !== null && evidence.browserTest.workerCount !== 2);
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

function createSample(sample, index, runIds, schemaVersion) {
  const label = `browser test evidence review input.samples[${index}]`;
  assertOnlyAllowedFields(sample, new Set(['evidence', 'runId', 'workflowRun']), label);
  assertPositiveSafeInteger(sample.runId, `${label}.runId`);

  if (!Object.hasOwn(sample, 'evidence')) {
    throw new Error(`${label}.evidence is required`);
  }

  if (runIds.has(sample.runId)) {
    throw new Error(`${label}.runId must be unique`);
  }

  runIds.add(sample.runId);

  return {
    evidence: sample.evidence === null && schemaVersion === browserTestEvidenceReviewSchemaVersion
      ? null
      : assertBrowserTestEvidenceContract(sample.evidence),
    runId: sample.runId,
    workflowRun: assertWorkflowRun(sample.workflowRun, `${label}.workflowRun`),
  };
}

function summarizeSample({ evidence, runId, workflowRun }) {
  return {
    browserTest: evidence === null ? null : { ...evidence.browserTest },
    cleanup: evidence === null ? null : { ...evidence.cleanup },
    generatedAt: evidence === null ? null : evidence.generatedAt,
    runId,
    workflowRun,
  };
}

export function createBrowserTestEvidenceReviewInput({ samples, schemaVersion } = {}) {
  if (!supportedBrowserTestEvidenceReviewSchemaVersions.has(schemaVersion)) {
    throw new Error(`browser test evidence review input.schemaVersion must equal one of: ${[...supportedBrowserTestEvidenceReviewSchemaVersions].join(', ')}`);
  }

  if (!Array.isArray(samples)) {
    throw new Error('browser test evidence review input.samples must be an array');
  }

  const runIds = new Set();

  return {
    samples: samples.map((sample, index) => createSample(sample, index, runIds, schemaVersion)),
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
    case 'source_commit_changed':
      return `Source commit changed across the selected run IDs: ${finding.headShas.join(', ')}.`;
    case 'workflow_runs_overlapped':
      return `Workflow runs overlapped: ${finding.runIds.join(', ')}.`;
    case 'browser_test_evidence_unavailable':
      return `Browser-test evidence was unavailable for run IDs: ${finding.runIds.join(', ')}.`;
    case 'workflow_result_mismatch':
      return `Workflow and browser-test outcomes differ for run IDs: ${finding.runIds.join(', ')}.`;
    case 'browser_test_failed':
      return `Browser tests did not pass for run IDs: ${finding.runIds.join(', ')}.`;
    case 'cleanup_not_clean':
      return `Cleanup was not clean for run IDs: ${finding.runIds.join(', ')}.`;
    case 'worker_count_changed':
      return `Worker count changed for run IDs: ${finding.runIds.join(', ')}.`;
    default:
      throw new Error(`Unsupported browser test evidence review finding: ${finding.code}`);
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
