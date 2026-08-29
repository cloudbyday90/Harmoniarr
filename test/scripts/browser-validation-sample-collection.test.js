/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  browserValidationArtifactName,
  browserValidationEvidenceFileName,
  collectBrowserValidationSamples,
  createBrowserValidationSampleCollectionSummary,
  parseBrowserValidationSampleRunId,
} from '../../scripts/browser-validation-sample-collection.js';

const baselineSha = 'a'.repeat(40);
const repository = 'cloudbyday90/Harmoniarr';

function createEvidence({ status = 'passed' } = {}) {
  return JSON.stringify({
    browserTest: {
      durationMs: 301_000,
      status,
      workerCount: 2,
    },
    cleanup: {
      attempts: 1,
      browserTestProcessCount: 0,
      maxWaitMs: 25_000,
      status: 'clean',
      testcontainerCount: 0,
    },
    generatedAt: '2026-08-29T13:02:00.000Z',
    schemaVersion: 1,
  });
}

function createWorkflowRun({
  conclusion = 'success',
  headSha = baselineSha,
  id = 91_001,
  status = 'completed',
} = {}) {
  return {
    conclusion,
    event: 'workflow_dispatch',
    head_branch: 'main',
    head_sha: headSha,
    id,
    run_started_at: '2026-08-29T13:00:00.000Z',
    status,
    updated_at: '2026-08-29T13:05:00.000Z',
  };
}

function createCommandRunner({ artifactReadFails = false, existingRuns = [], newRun = createWorkflowRun() } = {}) {
  const calls = [];
  let workflowListRequests = 0;

  return {
    calls,
    runCommand: async ({ args, command }) => {
      calls.push({ args, command });
      assert.equal(command, 'gh');

      if (args[0] === 'api' && args[1].endsWith('/commits/main')) {
        return { stdout: JSON.stringify({ sha: baselineSha }) };
      }

      if (args[0] === 'api' && args[1].includes('/workflows/browser-validation.yml/runs?')) {
        workflowListRequests += 1;
        const workflowRuns = workflowListRequests === 1 || workflowListRequests === 2
          ? existingRuns
          : [newRun];
        return { stdout: JSON.stringify({ workflow_runs: workflowRuns }) };
      }

      if (args[0] === 'api' && args[1].endsWith(`/actions/runs/${newRun.id}`)) {
        return { stdout: JSON.stringify(newRun) };
      }

      if (args.slice(0, 3).join(' ') === 'workflow run browser-validation.yml') {
        return { stdout: '' };
      }

      if (args.slice(0, 2).join(' ') === 'run download') {
        return { stdout: '' };
      }

      throw new Error(`Unexpected GitHub CLI request: ${args.join(' ')}`);
    },
    readFile: async () => {
      if (artifactReadFails) {
        throw new Error('artifact missing');
      }

      return createEvidence();
    },
  };
}

test('serial Browser Validation collection dispatches one run and persists its bounded evidence manifest', async () => {
  const writes = [];
  const { calls, readFile, runCommand } = createCommandRunner();
  let removedTemporaryDirectory = null;

  const result = await collectBrowserValidationSamples({
    commandRunner: runCommand,
    cwd: process.cwd(),
    mkdtempFn: async () => 'C:/temporary/harmoniarr-browser-validation-a',
    mkdirFn: async () => {},
    nowFn: () => 0,
    outputPath: 'artifacts/browser-validation-input.json',
    pollIntervalMs: 1,
    readFileFn: readFile,
    removeDirectoryFn: async (directory) => {
      removedTemporaryDirectory = directory;
    },
    repository,
    sampleCount: 1,
    sleepFn: async () => {},
    tmpdirFn: () => 'C:/temporary',
    writeFileFn: async (filePath, content, encoding) => {
      writes.push({ content, encoding, filePath });
    },
  });

  assert.equal(result.completed, true);
  assert.equal(result.baselineSha, baselineSha);
  assert.equal(result.sampleCount, 1);
  assert.equal(result.manifest.samples[0].runId, 91_001);
  assert.equal(result.manifest.samples[0].evidence.browserTest.workerCount, 2);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].encoding, 'utf8');
  assert.equal(removedTemporaryDirectory, 'C:/temporary/harmoniarr-browser-validation-a');
  assert.deepEqual(calls.find(({ args }) => args[0] === 'workflow').args, [
    'workflow',
    'run',
    'browser-validation.yml',
    '--ref',
    'main',
    '--repo',
    repository,
  ]);
  assert.deepEqual(calls.find(({ args }) => args.slice(0, 2).join(' ') === 'run download').args, [
    'run',
    'download',
    '91001',
    '--name',
    browserValidationArtifactName,
    '--dir',
    'C:/temporary/harmoniarr-browser-validation-a',
    '--repo',
    repository,
  ]);
  assert.match(createBrowserValidationSampleCollectionSummary(result), /Samples retained: 1\/10\./u);
});

test('serial Browser Validation collection retains a terminal run without an artifact and stops safely', async () => {
  const writes = [];
  const { readFile, runCommand } = createCommandRunner({
    artifactReadFails: true,
    newRun: createWorkflowRun({ conclusion: 'cancelled' }),
  });

  const result = await collectBrowserValidationSamples({
    commandRunner: runCommand,
    cwd: process.cwd(),
    mkdtempFn: async () => 'C:/temporary/harmoniarr-browser-validation-b',
    mkdirFn: async () => {},
    nowFn: () => 0,
    outputPath: 'artifacts/browser-validation-input.json',
    pollIntervalMs: 1,
    readFileFn: readFile,
    removeDirectoryFn: async () => {},
    repository,
    sampleCount: 1,
    sleepFn: async () => {},
    tmpdirFn: () => 'C:/temporary',
    writeFileFn: async (_filePath, content) => {
      writes.push(JSON.parse(content));
    },
  });

  assert.equal(result.completed, false);
  assert.equal(result.manifest.samples[0].evidence, null);
  assert.equal(result.manifest.samples[0].workflowRun.conclusion, 'cancelled');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].samples[0].evidence, null);
});

test('serial Browser Validation collection can retain a completed initial run after an interrupted operator session', async () => {
  const { calls, runCommand } = createCommandRunner();
  const missingManifest = new Error('manifest not found');
  missingManifest.code = 'ENOENT';

  const result = await collectBrowserValidationSamples({
    commandRunner: runCommand,
    cwd: process.cwd(),
    initialRunId: 91_001,
    mkdtempFn: async () => 'C:/temporary/harmoniarr-browser-validation-c',
    mkdirFn: async () => {},
    outputPath: 'artifacts/browser-validation-input.json',
    pollIntervalMs: 1,
    readCollectionManifestFn: async () => {
      throw missingManifest;
    },
    readFileFn: async () => createEvidence(),
    removeDirectoryFn: async () => {},
    repository,
    sampleCount: 1,
    tmpdirFn: () => 'C:/temporary',
    writeFileFn: async () => {},
  });

  assert.equal(result.completed, true);
  assert.equal(result.sampleCount, 1);
  assert.equal(result.manifest.samples[0].runId, 91_001);
  assert.equal(calls.some(({ args }) => args[0] === 'workflow'), false);
});

test('serial Browser Validation collection recovers one completed run after a partial manifest write interruption', async () => {
  const { calls, runCommand } = createCommandRunner();
  const retainedSample = {
    evidence: JSON.parse(createEvidence()),
    runId: 91_000,
    workflowRun: {
      completedAt: '2026-08-29T12:59:00.000Z',
      conclusion: 'success',
      event: 'workflow_dispatch',
      headBranch: 'main',
      headSha: baselineSha,
      startedAt: '2026-08-29T12:54:00.000Z',
    },
  };

  const result = await collectBrowserValidationSamples({
    commandRunner: runCommand,
    cwd: process.cwd(),
    initialRunId: 91_001,
    mkdtempFn: async () => 'C:/temporary/harmoniarr-browser-validation-d',
    mkdirFn: async () => {},
    outputPath: 'artifacts/browser-validation-input.json',
    pollIntervalMs: 1,
    readCollectionManifestFn: async () => JSON.stringify({
      samples: [retainedSample],
      schemaVersion: 2,
    }),
    readFileFn: async () => createEvidence(),
    removeDirectoryFn: async () => {},
    repository,
    sampleCount: 2,
    tmpdirFn: () => 'C:/temporary',
    writeFileFn: async () => {},
  });

  assert.equal(result.completed, true);
  assert.deepEqual(result.manifest.samples.map((sample) => sample.runId), [91_000, 91_001]);
  assert.equal(calls.some(({ args }) => args[0] === 'workflow'), false);
});

test('serial Browser Validation collection refuses concurrent or source-drifted workflow runs', async () => {
  const activeRunner = createCommandRunner({
    existingRuns: [createWorkflowRun({ id: 91_000, status: 'in_progress' })],
  });

  await assert.rejects(
    () => collectBrowserValidationSamples({
      commandRunner: activeRunner.runCommand,
      outputPath: 'artifacts/browser-validation-input.json',
      pollIntervalMs: 1,
      repository,
      sampleCount: 1,
    }),
    /already has active run IDs: 91000/u,
  );

  const sourceDriftRunner = createCommandRunner({
    newRun: createWorkflowRun({ headSha: 'b'.repeat(40) }),
  });

  await assert.rejects(
    () => collectBrowserValidationSamples({
      commandRunner: sourceDriftRunner.runCommand,
      outputPath: 'artifacts/browser-validation-input.json',
      pollIntervalMs: 1,
      repository,
      sampleCount: 1,
      sleepFn: async () => {},
    }),
    /used unexpected commit/u,
  );
});

test('serial Browser Validation collection validates its bounded operator inputs', async () => {
  await assert.rejects(
    () => collectBrowserValidationSamples({
      outputPath: 'artifacts/browser-validation-input.json',
      repository,
      sampleCount: 11,
    }),
    /sampleCount must not exceed 10/u,
  );
  await assert.rejects(
    () => collectBrowserValidationSamples({
      outputPath: '../outside.json',
      repository,
      sampleCount: 1,
    }),
    /browser test evidence path must remain within the working directory/u,
  );
  assert.equal(browserValidationEvidenceFileName, 'harmoniarr-browser-test.json');
  assert.equal(parseBrowserValidationSampleRunId('91001'), 91_001);
  assert.throws(
    () => parseBrowserValidationSampleRunId('-1'),
    /initialRunId must be a positive safe integer/u,
  );
});
