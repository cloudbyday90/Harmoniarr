/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { resolveBrowserTestEvidencePath } from './browser-test-evidence.js';
import {
  browserValidationArtifactName,
  browserValidationEvidenceFileName,
  browserValidationWorkflowBranch,
  browserValidationWorkflowFileName,
  assertBrowserValidationRepository,
  dispatchBrowserValidationWorkflow,
  downloadBrowserValidationEvidence,
  getBrowserValidationMainCommitSha,
  getBrowserValidationWorkflowRun,
  listBrowserValidationWorkflowRuns,
  resolveBrowserValidationRepository,
} from './github-actions-browser-validation-client.js';
import {
  browserTestEvidenceReviewRequiredSampleCount,
  browserTestEvidenceReviewSchemaVersion,
  createBrowserTestEvidenceReviewInput,
} from './browser-test-evidence-review.js';
import { runBufferedCommand } from './process-runtime.js';

export {
  browserValidationArtifactName,
  browserValidationEvidenceFileName,
  browserValidationWorkflowBranch,
  browserValidationWorkflowFileName,
};

export const browserValidationSamplePollIntervalMs = 10_000;
export const browserValidationSampleDiscoveryTimeoutMs = 120_000;
export const browserValidationSampleCompletionTimeoutMs = 1_500_000;

function assertPositiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function assertPositiveSafeIntegerAtMost(value, maximum, label) {
  assertPositiveSafeInteger(value, label);

  if (value > maximum) {
    throw new Error(`${label} must not exceed ${maximum}`);
  }
}

function getNewWorkflowRunCandidate({ baselineSha, knownRunIds, workflowRuns }) {
  const newRuns = workflowRuns.filter(({ id }) => !knownRunIds.has(id));

  if (newRuns.length === 0) {
    return null;
  }

  const unexpectedRun = newRuns.find(({ headSha }) => headSha !== baselineSha);
  if (unexpectedRun) {
    throw new Error(`A new Browser Validation run used unexpected commit ${unexpectedRun.headSha}`);
  }

  if (newRuns.length > 1) {
    throw new Error('More than one new Browser Validation run appeared; collection must remain serial');
  }

  return newRuns[0];
}

function createCollectionManifest(samples) {
  return createBrowserTestEvidenceReviewInput({
    samples,
    schemaVersion: browserTestEvidenceReviewSchemaVersion,
  });
}

function createCollectionSample({ evidence, runId, workflowRun }) {
  return createCollectionManifest([{
    evidence,
    runId,
    workflowRun,
  }]).samples[0];
}

function createRunIdSet(workflowRuns) {
  return new Set(workflowRuns.map(({ id }) => id));
}

function getInProgressRunIds(workflowRuns) {
  return workflowRuns
    .filter(({ status }) => status !== 'completed')
    .map(({ id }) => id);
}

async function wait(delayMs) {
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function waitForNewWorkflowRun({
  baselineSha,
  commandRunner,
  cwd,
  env,
  knownRunIds,
  nowFn,
  pollIntervalMs,
  repository,
  sleepFn,
  timeoutMs,
}) {
  const deadline = nowFn() + timeoutMs;

  while (nowFn() <= deadline) {
    const workflowRuns = await listBrowserValidationWorkflowRuns({
      commandRunner,
      cwd,
      env,
      repository,
      timeoutMs: pollIntervalMs,
    });
    const candidate = getNewWorkflowRunCandidate({ baselineSha, knownRunIds, workflowRuns });

    if (candidate) {
      return candidate;
    }

    await sleepFn(pollIntervalMs);
  }

  throw new Error(`Timed out waiting ${timeoutMs}ms for a new Browser Validation workflow run`);
}

async function waitForWorkflowCompletion({
  commandRunner,
  cwd,
  env,
  nowFn,
  pollIntervalMs,
  repository,
  runId,
  sleepFn,
  timeoutMs,
}) {
  const deadline = nowFn() + timeoutMs;

  while (nowFn() <= deadline) {
    const workflowRun = await getBrowserValidationWorkflowRun({
      commandRunner,
      cwd,
      env,
      repository,
      runId,
      timeoutMs: pollIntervalMs,
    });

    if (workflowRun.terminalWorkflowRun !== null) {
      return workflowRun.terminalWorkflowRun;
    }

    await sleepFn(pollIntervalMs);
  }

  throw new Error(`Timed out waiting ${timeoutMs}ms for Browser Validation run ${runId}`);
}

async function writeCollectionManifest({ cwd, mkdirFn, outputPath, samples, writeFileFn }) {
  const manifest = createCollectionManifest(samples);
  const resolvedOutputPath = resolveBrowserTestEvidencePath(outputPath, { cwd });

  await mkdirFn(dirname(resolvedOutputPath), { recursive: true });
  await writeFileFn(resolvedOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    manifest,
    outputPath: resolvedOutputPath,
  };
}

export function createBrowserValidationSampleCollectionSummary({
  baselineSha,
  completed,
  outputPath,
  sampleCount,
} = {}) {
  const completion = completed ? 'complete' : 'stopped before all selected samples could be collected';

  return [
    `Browser Validation sample collection ${completion}.`,
    `Samples retained: ${sampleCount}/${browserTestEvidenceReviewRequiredSampleCount}.`,
    `Source commit: ${baselineSha}.`,
    `Manifest: ${outputPath}.`,
  ].join('\n');
}

export async function collectBrowserValidationSamples({
  commandRunner = runBufferedCommand,
  cwd = process.cwd(),
  env = process.env,
  mkdtempFn,
  mkdirFn = mkdir,
  nowFn = Date.now,
  outputPath,
  pollIntervalMs = browserValidationSamplePollIntervalMs,
  readFileFn,
  removeDirectoryFn,
  repository = null,
  sampleCount = browserTestEvidenceReviewRequiredSampleCount,
  sleepFn = wait,
  tmpdirFn,
  writeFileFn = writeFile,
} = {}) {
  assertPositiveSafeIntegerAtMost(
    sampleCount,
    browserTestEvidenceReviewRequiredSampleCount,
    'sampleCount',
  );
  assertPositiveSafeInteger(pollIntervalMs, 'pollIntervalMs');
  const resolvedOutputPath = resolveBrowserTestEvidencePath(outputPath, { cwd });

  const resolvedRepository = repository === null
    ? await resolveBrowserValidationRepository({ commandRunner, cwd, env, timeoutMs: pollIntervalMs })
    : assertBrowserValidationRepository(repository);
  const baselineSha = await getBrowserValidationMainCommitSha({
    commandRunner,
    cwd,
    env,
    repository: resolvedRepository,
    timeoutMs: pollIntervalMs,
  });
  const samples = [];
  let persisted = null;

  for (let index = 0; index < sampleCount; index += 1) {
    const existingWorkflowRuns = await listBrowserValidationWorkflowRuns({
      commandRunner,
      cwd,
      env,
      repository: resolvedRepository,
      timeoutMs: pollIntervalMs,
    });
    const inProgressRunIds = getInProgressRunIds(existingWorkflowRuns);

    if (inProgressRunIds.length > 0) {
      throw new Error(`Browser Validation already has active run IDs: ${inProgressRunIds.join(', ')}`);
    }

    await dispatchBrowserValidationWorkflow({
      commandRunner,
      cwd,
      env,
      repository: resolvedRepository,
      timeoutMs: pollIntervalMs,
    });
    const candidate = await waitForNewWorkflowRun({
      baselineSha,
      commandRunner,
      cwd,
      env,
      knownRunIds: createRunIdSet(existingWorkflowRuns),
      nowFn,
      pollIntervalMs,
      repository: resolvedRepository,
      sleepFn,
      timeoutMs: browserValidationSampleDiscoveryTimeoutMs,
    });
    const workflowRun = await waitForWorkflowCompletion({
      commandRunner,
      cwd,
      env,
      nowFn,
      pollIntervalMs,
      repository: resolvedRepository,
      runId: candidate.id,
      sleepFn,
      timeoutMs: browserValidationSampleCompletionTimeoutMs,
    });

    let evidence;
    try {
      evidence = await downloadBrowserValidationEvidence({
        commandRunner,
        cwd,
        env,
        mkdtempFn,
        readFileFn,
        removeDirectoryFn,
        repository: resolvedRepository,
        runId: candidate.id,
        timeoutMs: pollIntervalMs,
        tmpdirFn,
      });
    } catch {
      evidence = null;
    }

    samples.push(createCollectionSample({
      evidence,
      runId: candidate.id,
      workflowRun,
    }));
    persisted = await writeCollectionManifest({
      cwd,
      mkdirFn,
      outputPath: resolvedOutputPath,
      samples,
      writeFileFn,
    });

    if (evidence === null) {
      return {
        baselineSha,
        completed: false,
        manifest: persisted.manifest,
        outputPath: persisted.outputPath,
        sampleCount: samples.length,
      };
    }
  }

  return {
    baselineSha,
    completed: true,
    manifest: persisted.manifest,
    outputPath: persisted.outputPath,
    sampleCount: samples.length,
  };
}
