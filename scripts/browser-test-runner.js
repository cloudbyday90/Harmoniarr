/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { spawn } from 'node:child_process';

import {
  getBrowserTestCleanupWaitMs,
  getOptionalBrowserTestEvidencePath,
  waitForBrowserTestCleanup,
  writeBrowserTestEvidence,
} from './browser-test-evidence.js';

export const defaultBrowserTestConcurrency = 2;

function parsePositiveSafeInteger(value, optionName) {
  if (!/^\d+$/u.test(value)) {
    throw new Error(`${optionName} must be a positive integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${optionName} must be a positive integer`);
  }

  return parsed;
}

export function parseBrowserTestConcurrency(args = process.argv.slice(2)) {
  if (!Array.isArray(args)) {
    throw new Error('args must be an array');
  }

  if (args.length === 0) {
    return defaultBrowserTestConcurrency;
  }

  if (args.length !== 1 || !args[0].startsWith('--concurrency=')) {
    throw new Error('Only --concurrency=<positive integer> is supported');
  }

  return parsePositiveSafeInteger(args[0].slice('--concurrency='.length), '--concurrency');
}

export function buildBrowserTestNodeArguments(concurrency) {
  const resolvedConcurrency = parsePositiveSafeInteger(String(concurrency), 'concurrency');

  return [
    '--test',
    '--test-force-exit',
    `--test-concurrency=${resolvedConcurrency}`,
    'test/browser/**/*.test.js',
  ];
}

export async function runBrowserTests({
  args = process.argv.slice(2),
  cwd = process.cwd(),
  env = process.env,
  now = Date.now,
  nodePath = process.execPath,
  spawnChild = spawn,
  waitForCleanup = waitForBrowserTestCleanup,
  writeEvidence = writeBrowserTestEvidence,
} = {}) {
  const concurrency = parseBrowserTestConcurrency(args);
  const nodeArguments = buildBrowserTestNodeArguments(concurrency);
  const configuredEvidencePath = getOptionalBrowserTestEvidencePath(env);
  const startedAtMs = now();
  let testFailure = null;

  try {
    await new Promise((resolvePromise, reject) => {
      const child = spawnChild(nodePath, nodeArguments, {
        cwd,
        stdio: 'inherit',
        windowsHide: true,
      });

      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (code === 0) {
          resolvePromise();
          return;
        }

        if (signal) {
          reject(new Error(`Browser tests terminated by signal ${signal}`));
          return;
        }

        reject(new Error(`Browser tests exited with code ${code ?? 'unknown'}`));
      });
    });
  } catch (error) {
    testFailure = error;
  }

  const durationMs = Math.max(0, now() - startedAtMs);

  if (!configuredEvidencePath) {
    if (testFailure) {
      throw testFailure;
    }

    return { concurrency, durationMs };
  }

  const cleanup = await waitForCleanup({
    cwd,
    maxWaitMs: getBrowserTestCleanupWaitMs(env),
  });

  try {
    await writeEvidence({
      browserTest: {
        durationMs,
        status: testFailure ? 'failed' : 'passed',
        workerCount: concurrency,
      },
      cleanup,
      cwd,
      evidencePath: configuredEvidencePath,
    });
  } catch (error) {
    if (testFailure) {
      throw testFailure;
    }

    throw error;
  }

  if (testFailure) {
    throw testFailure;
  }

  if (cleanup.status !== 'clean') {
    throw new Error(`Browser test cleanup did not complete cleanly (${cleanup.status})`);
  }

  return { concurrency, durationMs };
}
