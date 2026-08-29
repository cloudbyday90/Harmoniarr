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
  assertBrowserTestEvidenceContract,
  browserTestCleanupWaitMsEnvVar,
  browserTestEvidencePathEnvVar,
  createBrowserTestEvidence,
  getBrowserTestCleanupWaitMs,
  getOptionalBrowserTestEvidencePath,
  inspectBrowserTestCleanup,
  parseBrowserTestEvidence,
  parseBrowserTestProcessIds,
  renderBrowserTestEvidenceSummary,
  resolveBrowserTestEvidencePath,
  waitForBrowserTestCleanup,
  writeBrowserTestEvidence,
  writeBrowserTestEvidenceSummary,
} from '../../scripts/browser-test-evidence.js';

function createEvidence({
  cleanup = {
    attempts: 1,
    browserTestProcessCount: 0,
    maxWaitMs: 25_000,
    status: 'clean',
    testcontainerCount: 0,
  },
} = {}) {
  return createBrowserTestEvidence({
    browserTest: {
      durationMs: 12_345,
      status: 'passed',
      workerCount: 2,
    },
    cleanup,
    generatedAt: '2026-08-28T00:00:00.000Z',
  });
}

test('browser test evidence reads optional configuration and bounds cleanup waiting', () => {
  assert.equal(getOptionalBrowserTestEvidencePath({
    [browserTestEvidencePathEnvVar]: '  artifacts/browser-test.json  ',
  }), 'artifacts/browser-test.json');
  assert.equal(getOptionalBrowserTestEvidencePath({}), null);
  assert.equal(getBrowserTestCleanupWaitMs({}), 25_000);
  assert.equal(getBrowserTestCleanupWaitMs({ [browserTestCleanupWaitMsEnvVar]: '0' }), 0);
  assert.throws(
    () => getBrowserTestCleanupWaitMs({ [browserTestCleanupWaitMsEnvVar]: '60001' }),
    /must not exceed 60000/u,
  );
});

test('browser test evidence remains within the selected workspace', () => {
  const workspace = process.cwd();
  const resolvedEvidencePath = resolveBrowserTestEvidencePath('artifacts/browser-test.json', { cwd: workspace });

  assert.equal(resolvedEvidencePath.includes('artifacts'), true);
  assert.throws(
    () => resolveBrowserTestEvidencePath('../outside-browser-test.json', { cwd: workspace }),
    /must remain within the working directory/u,
  );
});

test('browser test process inspection retains only Node browser test process identifiers', () => {
  const linuxIds = parseBrowserTestProcessIds([
    '  41 /usr/local/bin/node --test --test-concurrency=2 test/browser/**/*.test.js',
    '  42 /usr/local/bin/node scripts/build-server.js',
    '  43 /usr/local/bin/node --test test/client/example.test.js',
  ].join('\n'), { platform: 'linux' });
  const windowsIds = parseBrowserTestProcessIds(JSON.stringify([
    {
      CommandLine: 'node.exe --test --test-concurrency=2 test\\browser\\example.test.js',
      ProcessId: 71,
    },
    {
      CommandLine: 'node.exe scripts/build-server.js',
      ProcessId: 72,
    },
  ]), { platform: 'win32' });

  assert.deepEqual(linuxIds, [41]);
  assert.deepEqual(windowsIds, [71]);
});

test('browser test cleanup inspection persists counts rather than container ids or process commands', async () => {
  const inspection = await inspectBrowserTestCleanup({
    platform: 'linux',
    runCommand: async ({ command }) => command === 'docker'
      ? { stdout: 'container-a\ncontainer-b\n' }
      : { stdout: '  41 node --test test/browser/**/*.test.js\n  42 node scripts/build-server.js\n' },
  });

  assert.deepEqual(inspection, {
    browserTestProcessCount: 1,
    testcontainerCount: 2,
  });
});

test('browser test cleanup polling waits for resources to exit and reports bounded failures', async () => {
  let firstInspection = true;
  const cleaned = await waitForBrowserTestCleanup({
    maxWaitMs: 1_000,
    now: () => 0,
    platform: 'linux',
    runCommand: async ({ command }) => command === 'docker'
      ? { stdout: firstInspection ? 'container-a\n' : '' }
      : { stdout: firstInspection ? '  41 node --test test/browser/**/*.test.js\n' : '' },
    wait: async () => {
      firstInspection = false;
    },
  });

  let time = 0;
  const resourcesRemaining = await waitForBrowserTestCleanup({
    maxWaitMs: 50,
    now: () => time,
    platform: 'linux',
    runCommand: async ({ command }) => command === 'docker'
      ? { stdout: 'container-a\n' }
      : { stdout: '  41 node --test test/browser/**/*.test.js\n' },
    wait: async () => {
      time = 50;
    },
  });
  const failedInspection = await waitForBrowserTestCleanup({
    maxWaitMs: 1_000,
    runCommand: async () => {
      throw new Error('inspection failed');
    },
  });

  assert.deepEqual(cleaned, {
    attempts: 2,
    browserTestProcessCount: 0,
    maxWaitMs: 1_000,
    status: 'clean',
    testcontainerCount: 0,
  });
  assert.deepEqual(resourcesRemaining, {
    attempts: 2,
    browserTestProcessCount: 1,
    maxWaitMs: 50,
    status: 'resources_remaining',
    testcontainerCount: 1,
  });
  assert.deepEqual(failedInspection, {
    attempts: 1,
    maxWaitMs: 1_000,
    status: 'check_failed',
  });
});

test('browser test evidence validates bounded data, writes within the workspace, and renders a safe summary', async () => {
  const evidence = createEvidence();
  const writes = [];
  const directories = [];
  const result = await writeBrowserTestEvidence({
    ...evidence,
    cwd: process.cwd(),
    evidencePath: 'artifacts/browser-test.json',
    mkdirFn: async (directory, options) => {
      directories.push({ directory, options });
    },
    writeFileFn: async (filePath, content, encoding) => {
      writes.push({ content, encoding, filePath });
    },
  });
  const summary = renderBrowserTestEvidenceSummary(evidence);

  assert.equal(result.evidencePath.includes('artifacts'), true);
  assert.equal(directories.length, 1);
  assert.equal(writes[0].encoding, 'utf8');
  assert.match(writes[0].content, /"workerCount": 2/u);
  assert.match(summary, /Test result: \*\*Passed\*\*/u);
  assert.match(summary, /no Testcontainers or browser-test Node processes remained/u);
  assert.throws(() => assertBrowserTestEvidenceContract({
    ...evidence,
    workspaceRoot: 'C:\\Users\\operator',
  }), /workspaceRoot is not allowed/u);
});

test('browser test evidence parsing and summary writing reject untrusted payloads', async () => {
  const evidence = createEvidence();
  const writes = [];

  assert.throws(() => parseBrowserTestEvidence('{not-json'), /must be valid JSON/u);
  await writeBrowserTestEvidenceSummary({
    appendFileFn: async (filePath, content) => {
      writes.push({ content, filePath });
    },
    cwd: process.cwd(),
    evidencePath: 'artifacts/browser-test.json',
    readFileFn: async (filePath) => {
      assert.equal(filePath.includes('artifacts'), true);
      return JSON.stringify(evidence);
    },
    summaryPath: 'artifacts/summary.md',
  });

  assert.deepEqual(writes.map(({ filePath }) => filePath), ['artifacts/summary.md']);
  assert.match(writes[0].content, /Fixed Node workers: \*\*2\*\*/u);
});
