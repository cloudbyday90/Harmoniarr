/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { runBufferedCommand } from './process-runtime.js';
import { normalizeOptionalString, parseNonNegativeIntegerInput } from './script-input-resolution.js';

export const browserTestEvidencePathEnvVar = 'HARMONIARR_BROWSER_TEST_EVIDENCE_PATH';
export const browserTestEvidenceSummaryPathEnvVar = 'HARMONIARR_BROWSER_TEST_EVIDENCE_SUMMARY_PATH';
export const browserTestCleanupWaitMsEnvVar = 'HARMONIARR_BROWSER_TEST_CLEANUP_WAIT_MS';
export const defaultBrowserTestCleanupWaitMs = 25_000;
export const maximumBrowserTestCleanupWaitMs = 60_000;
export const browserTestCleanupPollIntervalMs = 1_000;

const browserTestEvidenceSchemaVersion = 1;
const browserTestProcessPattern = /\bnode(?:\.exe)?\b/iu;

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertOnlyAllowedFields(value, allowedFields, label) {
  assertObject(value, label);

  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      throw new Error(`${label}.${field} is not allowed in browser test evidence`);
    }
  }
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function assertIsoTimestamp(value, label) {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
    || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
}

function assertStatus(value, allowedStatuses, label) {
  if (!allowedStatuses.has(value)) {
    throw new Error(`${label} must be one of: ${[...allowedStatuses].join(', ')}`);
  }
}

function assertBrowserTestSection(browserTest) {
  assertOnlyAllowedFields(browserTest, new Set([
    'durationMs',
    'status',
    'workerCount',
  ]), 'browser test evidence.browserTest');
  assertNonNegativeInteger(browserTest.durationMs, 'browser test evidence.browserTest.durationMs');
  assertStatus(browserTest.status, new Set(['failed', 'passed']), 'browser test evidence.browserTest.status');
  assertPositiveInteger(browserTest.workerCount, 'browser test evidence.browserTest.workerCount');
}

function assertCleanupSection(cleanup) {
  assertOnlyAllowedFields(cleanup, new Set([
    'attempts',
    'browserTestProcessCount',
    'maxWaitMs',
    'status',
    'testcontainerCount',
  ]), 'browser test evidence.cleanup');
  assertPositiveInteger(cleanup.attempts, 'browser test evidence.cleanup.attempts');
  assertNonNegativeInteger(cleanup.maxWaitMs, 'browser test evidence.cleanup.maxWaitMs');
  assertStatus(cleanup.status, new Set(['check_failed', 'clean', 'resources_remaining']), 'browser test evidence.cleanup.status');

  if (cleanup.status === 'check_failed') {
    return;
  }

  assertNonNegativeInteger(cleanup.browserTestProcessCount, 'browser test evidence.cleanup.browserTestProcessCount');
  assertNonNegativeInteger(cleanup.testcontainerCount, 'browser test evidence.cleanup.testcontainerCount');
}

function normalizeEvidencePath(value) {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized : null;
}

function normalizeProcessId(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/u.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function isBrowserTestProcess(commandLine) {
  return typeof commandLine === 'string'
    && browserTestProcessPattern.test(commandLine)
    && commandLine.includes('--test')
    && (commandLine.includes('test/browser/') || commandLine.includes('test\\browser\\'));
}

function parseLinuxProcessEntries(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => {
      const match = line.match(/^\s*(\d+)\s+(.+)$/u);
      return match
        ? { commandLine: match[2], processId: normalizeProcessId(match[1]) }
        : null;
    })
    .filter(Boolean);
}

function parseWindowsProcessEntries(output) {
  if (output.trim() === '') {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error('Windows browser test process inspection must return valid JSON');
  }

  return (Array.isArray(parsed) ? parsed : [parsed])
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      commandLine: entry.CommandLine,
      processId: normalizeProcessId(entry.ProcessId),
    }));
}

function getProcessInspectionCommand(platform) {
  if (platform === 'win32') {
    return {
      args: [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress',
      ],
      command: 'powershell.exe',
    };
  }

  return {
    args: ['-eo', 'pid=,args='],
    command: 'ps',
  };
}

function createCleanupCheckFailure({ attempts, maxWaitMs }) {
  return {
    attempts,
    maxWaitMs,
    status: 'check_failed',
  };
}

export function getOptionalBrowserTestEvidencePath(env = process.env) {
  return normalizeEvidencePath(env?.[browserTestEvidencePathEnvVar]);
}

export function getBrowserTestCleanupWaitMs(env = process.env) {
  const waitMs = parseNonNegativeIntegerInput({
    defaultValue: String(defaultBrowserTestCleanupWaitMs),
    env,
    envName: browserTestCleanupWaitMsEnvVar,
  });

  if (waitMs > maximumBrowserTestCleanupWaitMs) {
    throw new Error(`${browserTestCleanupWaitMsEnvVar} must not exceed ${maximumBrowserTestCleanupWaitMs}`);
  }

  return waitMs;
}

export function resolveBrowserTestEvidencePath(evidencePath, {
  cwd = process.cwd(),
} = {}) {
  const normalizedEvidencePath = normalizeEvidencePath(evidencePath);
  if (!normalizedEvidencePath) {
    throw new Error('browser test evidence path is required');
  }

  const workspaceRoot = resolve(cwd);
  const resolvedEvidencePath = resolve(workspaceRoot, normalizedEvidencePath);
  const workspaceRelativePath = relative(workspaceRoot, resolvedEvidencePath);

  if (workspaceRelativePath === ''
    || workspaceRelativePath === '..'
    || workspaceRelativePath.startsWith('..\\')
    || workspaceRelativePath.startsWith('../')
    || isAbsolute(workspaceRelativePath)) {
    throw new Error('browser test evidence path must remain within the working directory');
  }

  return resolvedEvidencePath;
}

export function parseBrowserTestProcessIds(output, {
  platform = process.platform,
} = {}) {
  if (typeof output !== 'string') {
    throw new Error('browser test process inspection output must be a string');
  }

  const entries = platform === 'win32'
    ? parseWindowsProcessEntries(output)
    : parseLinuxProcessEntries(output);

  return entries
    .filter(({ commandLine, processId }) => processId && isBrowserTestProcess(commandLine))
    .map(({ processId }) => processId);
}

export function createBrowserTestEvidence({
  browserTest,
  cleanup,
  generatedAt = new Date().toISOString(),
} = {}) {
  assertBrowserTestSection(browserTest);
  assertCleanupSection(cleanup);
  assertIsoTimestamp(generatedAt, 'browser test evidence.generatedAt');

  return {
    browserTest: { ...browserTest },
    cleanup: { ...cleanup },
    generatedAt,
    schemaVersion: browserTestEvidenceSchemaVersion,
  };
}

export function assertBrowserTestEvidenceContract(evidence) {
  assertOnlyAllowedFields(evidence, new Set([
    'browserTest',
    'cleanup',
    'generatedAt',
    'schemaVersion',
  ]), 'browser test evidence');

  if (evidence.schemaVersion !== browserTestEvidenceSchemaVersion) {
    throw new Error(`browser test evidence.schemaVersion must equal ${browserTestEvidenceSchemaVersion}`);
  }

  return createBrowserTestEvidence(evidence);
}

export function parseBrowserTestEvidence(text) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('browser test evidence text is required');
  }

  try {
    return assertBrowserTestEvidenceContract(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('browser test evidence must be valid JSON', { cause: error });
    }

    throw error;
  }
}

export async function inspectBrowserTestCleanup({
  cwd = process.cwd(),
  platform = process.platform,
  runCommand = runBufferedCommand,
} = {}) {
  const processInspection = getProcessInspectionCommand(platform);
  const [dockerResult, processResult] = await Promise.all([
    runCommand({
      args: ['ps', '-aq', '--filter', 'label=org.testcontainers'],
      command: 'docker',
      cwd,
      timeoutMs: 10_000,
    }),
    runCommand({
      ...processInspection,
      cwd,
      timeoutMs: 10_000,
    }),
  ]);

  const testcontainerCount = dockerResult.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .length;
  const browserTestProcessCount = parseBrowserTestProcessIds(processResult.stdout, { platform }).length;

  return {
    browserTestProcessCount,
    testcontainerCount,
  };
}

export async function waitForBrowserTestCleanup({
  cwd = process.cwd(),
  maxWaitMs = defaultBrowserTestCleanupWaitMs,
  now = Date.now,
  platform = process.platform,
  pollIntervalMs = browserTestCleanupPollIntervalMs,
  runCommand = runBufferedCommand,
  wait = (milliseconds) => new Promise((resolveWait) => {
    setTimeout(resolveWait, milliseconds);
  }),
} = {}) {
  assertNonNegativeInteger(maxWaitMs, 'maxWaitMs');
  assertPositiveInteger(pollIntervalMs, 'pollIntervalMs');

  const startedAtMs = now();
  let attempts = 0;

  while (true) {
    attempts += 1;

    let inspection;
    try {
      inspection = await inspectBrowserTestCleanup({
        cwd,
        platform,
        runCommand,
      });
    } catch {
      return createCleanupCheckFailure({ attempts, maxWaitMs });
    }

    if (inspection.testcontainerCount === 0 && inspection.browserTestProcessCount === 0) {
      return {
        ...inspection,
        attempts,
        maxWaitMs,
        status: 'clean',
      };
    }

    const elapsedMs = now() - startedAtMs;
    if (elapsedMs >= maxWaitMs) {
      return {
        ...inspection,
        attempts,
        maxWaitMs,
        status: 'resources_remaining',
      };
    }

    await wait(Math.min(pollIntervalMs, Math.max(0, maxWaitMs - elapsedMs)));
  }
}

export async function writeBrowserTestEvidence({
  cwd = process.cwd(),
  evidencePath,
  mkdirFn = mkdir,
  writeFileFn = writeFile,
  ...evidenceInput
} = {}) {
  const resolvedEvidencePath = resolveBrowserTestEvidencePath(evidencePath, { cwd });
  const evidence = createBrowserTestEvidence(evidenceInput);

  await mkdirFn(dirname(resolvedEvidencePath), { recursive: true });
  await writeFileFn(resolvedEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

  return {
    evidence,
    evidencePath: resolvedEvidencePath,
  };
}

function formatDuration(durationMs) {
  return `${(durationMs / 1_000).toFixed(1)} seconds`;
}

function getCleanupSummary(cleanup) {
  switch (cleanup.status) {
    case 'clean':
      return `Clean after ${cleanup.attempts} check${cleanup.attempts === 1 ? '' : 's'}: no Testcontainers or browser-test Node processes remained.`;
    case 'resources_remaining':
      return `Attention required: ${cleanup.testcontainerCount} Testcontainers and ${cleanup.browserTestProcessCount} browser-test Node processes remained after ${formatDuration(cleanup.maxWaitMs)}.`;
    default:
      return 'Attention required: the cleanup inspection could not complete.';
  }
}

export function renderBrowserTestEvidenceSummary(evidence) {
  const validatedEvidence = assertBrowserTestEvidenceContract(evidence);
  const testResult = validatedEvidence.browserTest.status === 'passed' ? 'Passed' : 'Failed';

  return [
    '### Browser test isolation evidence',
    '',
    `- Test result: **${testResult}**`,
    `- Fixed Node workers: **${validatedEvidence.browserTest.workerCount}**`,
    `- Test runtime: **${formatDuration(validatedEvidence.browserTest.durationMs)}**`,
    `- Cleanup: ${getCleanupSummary(validatedEvidence.cleanup)}`,
    '',
  ].join('\n');
}

export async function writeBrowserTestEvidenceSummary({
  appendFileFn,
  cwd = process.cwd(),
  evidencePath,
  readFileFn = readFile,
  summaryPath,
} = {}) {
  if (!normalizeEvidencePath(summaryPath)) {
    throw new Error('browser test evidence summary path is required');
  }

  const resolvedEvidencePath = resolveBrowserTestEvidencePath(evidencePath, { cwd });
  const text = await readFileFn(resolvedEvidencePath, 'utf8');
  const summary = renderBrowserTestEvidenceSummary(parseBrowserTestEvidence(text));
  const writeSummary = appendFileFn ?? (async (filePath, content) => writeFile(filePath, content, { encoding: 'utf8', flag: 'a' }));

  await writeSummary(summaryPath, summary);
  return summary;
}
