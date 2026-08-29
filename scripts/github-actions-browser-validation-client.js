/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { parseBrowserTestEvidence } from './browser-test-evidence.js';
import { runBufferedCommand } from './process-runtime.js';

export const browserValidationArtifactName = 'harmoniarr-browser-isolation-evidence';
export const browserValidationEvidenceFileName = 'harmoniarr-browser-test.json';
export const browserValidationWorkflowFileName = 'browser-validation.yml';
export const browserValidationWorkflowBranch = 'main';

const gitHubRepositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const gitShaPattern = /^[a-f0-9]{40}$/u;
const isoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
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

function assertPositiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function assertIsoTimestamp(value, label) {
  if (typeof value !== 'string' || !isoTimestampPattern.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
}

function assertGitHubRepository(value) {
  if (typeof value !== 'string' || !gitHubRepositoryPattern.test(value)) {
    throw new Error('GitHub repository must be an owner/name value');
  }

  return value;
}

function assertGitSha(value, label) {
  if (typeof value !== 'string' || !gitShaPattern.test(value)) {
    throw new Error(`${label} must be a lowercase 40-character Git SHA`);
  }

  return value;
}

function parseGitHubJson(text, label) {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error(`${label} must be JSON`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${label} must be valid JSON`, { cause: error });
    }

    throw error;
  }
}

function getWorkflowRunsEndpoint(repository) {
  return `repos/${repository}/actions/workflows/${browserValidationWorkflowFileName}/runs?event=workflow_dispatch&branch=${browserValidationWorkflowBranch}&per_page=100`;
}

function getWorkflowRunEndpoint(repository, runId) {
  return `repos/${repository}/actions/runs/${runId}`;
}

function getMainCommitEndpoint(repository) {
  return `repos/${repository}/commits/${browserValidationWorkflowBranch}`;
}

function createWorkflowRunCandidate(workflowRun, label) {
  assertObject(workflowRun, label);
  assertPositiveSafeInteger(workflowRun.id, `${label}.id`);

  if (workflowRun.event !== 'workflow_dispatch') {
    throw new Error(`${label}.event must equal workflow_dispatch`);
  }

  if (workflowRun.head_branch !== browserValidationWorkflowBranch) {
    throw new Error(`${label}.head_branch must equal ${browserValidationWorkflowBranch}`);
  }

  return {
    headSha: assertGitSha(workflowRun.head_sha, `${label}.head_sha`),
    id: workflowRun.id,
    status: workflowRun.status,
  };
}

function createTerminalWorkflowRun(workflowRun, label) {
  const candidate = createWorkflowRunCandidate(workflowRun, label);

  if (candidate.status !== 'completed') {
    throw new Error(`${label}.status must equal completed`);
  }

  if (!terminalWorkflowConclusions.has(workflowRun.conclusion)) {
    throw new Error(`${label}.conclusion must be a supported terminal GitHub Actions conclusion`);
  }

  assertIsoTimestamp(workflowRun.run_started_at, `${label}.run_started_at`);
  assertIsoTimestamp(workflowRun.updated_at, `${label}.updated_at`);

  if (Date.parse(workflowRun.updated_at) < Date.parse(workflowRun.run_started_at)) {
    throw new Error(`${label}.updated_at must not precede ${label}.run_started_at`);
  }

  return {
    completedAt: workflowRun.updated_at,
    conclusion: workflowRun.conclusion,
    event: workflowRun.event,
    headBranch: workflowRun.head_branch,
    headSha: candidate.headSha,
    startedAt: workflowRun.run_started_at,
  };
}

async function runGitHubCli({ args, commandRunner, cwd, env, timeoutMs }) {
  return commandRunner({
    args,
    command: 'gh',
    cwd,
    env,
    timeoutMs,
  });
}

async function requestGitHubApi({ commandRunner, cwd, endpoint, env, timeoutMs }) {
  const result = await runGitHubCli({
    args: ['api', endpoint],
    commandRunner,
    cwd,
    env,
    timeoutMs,
  });

  return parseGitHubJson(result.stdout, `GitHub response for ${endpoint}`);
}

export async function listBrowserValidationWorkflowRuns({
  commandRunner = runBufferedCommand,
  cwd = process.cwd(),
  env = process.env,
  repository,
  timeoutMs,
} = {}) {
  const payload = await requestGitHubApi({
    commandRunner,
    cwd,
    endpoint: getWorkflowRunsEndpoint(assertGitHubRepository(repository)),
    env,
    timeoutMs,
  });
  assertObject(payload, 'GitHub workflow-runs response');

  if (!Array.isArray(payload.workflow_runs)) {
    throw new Error('GitHub workflow-runs response.workflow_runs must be an array');
  }

  return payload.workflow_runs.map((workflowRun, index) => {
    return createWorkflowRunCandidate(workflowRun, `GitHub workflow-runs response.workflow_runs[${index}]`);
  });
}

export async function getBrowserValidationMainCommitSha({
  commandRunner = runBufferedCommand,
  cwd = process.cwd(),
  env = process.env,
  repository,
  timeoutMs,
} = {}) {
  const payload = await requestGitHubApi({
    commandRunner,
    cwd,
    endpoint: getMainCommitEndpoint(assertGitHubRepository(repository)),
    env,
    timeoutMs,
  });
  assertObject(payload, 'GitHub main-commit response');

  return assertGitSha(payload.sha, 'GitHub main-commit response.sha');
}

export async function resolveBrowserValidationRepository({
  commandRunner = runBufferedCommand,
  cwd = process.cwd(),
  env = process.env,
  timeoutMs,
} = {}) {
  const result = await runGitHubCli({
    args: ['repo', 'view', '--json', 'nameWithOwner'],
    commandRunner,
    cwd,
    env,
    timeoutMs,
  });
  const payload = parseGitHubJson(result.stdout, 'GitHub repository response');
  assertObject(payload, 'GitHub repository response');

  return assertGitHubRepository(payload.nameWithOwner);
}

export async function dispatchBrowserValidationWorkflow({
  commandRunner = runBufferedCommand,
  cwd = process.cwd(),
  env = process.env,
  repository,
  timeoutMs,
} = {}) {
  const resolvedRepository = assertGitHubRepository(repository);

  await runGitHubCli({
    args: [
      'workflow',
      'run',
      browserValidationWorkflowFileName,
      '--ref',
      browserValidationWorkflowBranch,
      '--repo',
      resolvedRepository,
    ],
    commandRunner,
    cwd,
    env,
    timeoutMs,
  });
}

export async function getBrowserValidationWorkflowRun({
  commandRunner = runBufferedCommand,
  cwd = process.cwd(),
  env = process.env,
  repository,
  runId,
  timeoutMs,
} = {}) {
  assertPositiveSafeInteger(runId, 'runId');
  const payload = await requestGitHubApi({
    commandRunner,
    cwd,
    endpoint: getWorkflowRunEndpoint(assertGitHubRepository(repository), runId),
    env,
    timeoutMs,
  });
  assertObject(payload, 'GitHub workflow-run response');

  return {
    status: payload.status,
    terminalWorkflowRun: payload.status === 'completed'
      ? createTerminalWorkflowRun(payload, 'GitHub workflow-run response')
      : null,
  };
}

export async function downloadBrowserValidationEvidence({
  commandRunner = runBufferedCommand,
  cwd = process.cwd(),
  env = process.env,
  mkdtempFn = mkdtemp,
  readFileFn = readFile,
  removeDirectoryFn = rm,
  repository,
  runId,
  timeoutMs,
  tmpdirFn = tmpdir,
} = {}) {
  assertPositiveSafeInteger(runId, 'runId');
  const resolvedRepository = assertGitHubRepository(repository);
  const temporaryDirectory = await mkdtempFn(join(tmpdirFn(), 'harmoniarr-browser-validation-'));

  try {
    await runGitHubCli({
      args: [
        'run',
        'download',
        String(runId),
        '--name',
        browserValidationArtifactName,
        '--dir',
        temporaryDirectory,
        '--repo',
        resolvedRepository,
      ],
      commandRunner,
      cwd,
      env,
      timeoutMs,
    });
    const evidenceText = await readFileFn(join(temporaryDirectory, browserValidationEvidenceFileName), 'utf8');

    return parseBrowserTestEvidence(evidenceText);
  } finally {
    await removeDirectoryFn(temporaryDirectory, { force: true, recursive: true });
  }
}

export function assertBrowserValidationRepository(value) {
  return assertGitHubRepository(value);
}
