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
import {
  createBrowserRuntimeDiagnosticOutputCollector,
  getOptionalBrowserRuntimeDiagnosticEvidencePath,
  writeBrowserRuntimeDiagnosticEvidence,
} from './browser-runtime-diagnostic-evidence.js';
import { browserRuntimeDiagnosticEnabledEnvVar } from '../testing/browser/browser-runtime-diagnostic.js';

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
  createDiagnosticOutputCollector = createBrowserRuntimeDiagnosticOutputCollector,
  cwd = process.cwd(),
  env = process.env,
  forwardChildOutput = (stream, chunk) => stream.write(chunk),
  now = Date.now,
  nodePath = process.execPath,
  spawnChild = spawn,
  waitForCleanup = waitForBrowserTestCleanup,
  writeRuntimeDiagnosticEvidence = writeBrowserRuntimeDiagnosticEvidence,
  writeEvidence = writeBrowserTestEvidence,
} = {}) {
  const concurrency = parseBrowserTestConcurrency(args);
  const nodeArguments = buildBrowserTestNodeArguments(concurrency);
  const configuredEvidencePath = getOptionalBrowserTestEvidencePath(env);
  const configuredRuntimeDiagnosticEvidencePath = getOptionalBrowserRuntimeDiagnosticEvidencePath(env);

  if (configuredRuntimeDiagnosticEvidencePath && env?.[browserRuntimeDiagnosticEnabledEnvVar] !== '1') {
    throw new Error(`${browserRuntimeDiagnosticEnabledEnvVar}=1 is required when browser runtime diagnostic evidence is enabled`);
  }

  const diagnosticOutputCollector = configuredRuntimeDiagnosticEvidencePath
    ? createDiagnosticOutputCollector()
    : null;
  const startedAtMs = now();
  let testFailure = null;

  try {
    await new Promise((resolvePromise, reject) => {
      const child = spawnChild(nodePath, nodeArguments, {
        cwd,
        stdio: diagnosticOutputCollector ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        windowsHide: true,
      });

      if (diagnosticOutputCollector) {
        for (const [stream, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
          stream?.on('data', (chunk) => {
            diagnosticOutputCollector.addChunk(chunk);
            forwardChildOutput(output, chunk);
          });
        }
      }

      child.once('error', reject);
      child.once(diagnosticOutputCollector ? 'close' : 'exit', (code, signal) => {
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
  let runtimeDiagnosticFailure = null;

  if (configuredRuntimeDiagnosticEvidencePath) {
    try {
      await writeRuntimeDiagnosticEvidence({
        browserTest: {
          durationMs,
          status: testFailure ? 'failed' : 'passed',
          workerCount: concurrency,
        },
        cwd,
        evidencePath: configuredRuntimeDiagnosticEvidencePath,
        ...diagnosticOutputCollector.finish(),
      });
    } catch (error) {
      runtimeDiagnosticFailure = error;
    }
  }

  if (!configuredEvidencePath) {
    if (testFailure) {
      throw testFailure;
    }

    if (runtimeDiagnosticFailure) {
      throw runtimeDiagnosticFailure;
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

  if (runtimeDiagnosticFailure) {
    throw runtimeDiagnosticFailure;
  }

  if (cleanup.status !== 'clean') {
    throw new Error(`Browser test cleanup did not complete cleanly (${cleanup.status})`);
  }

  return { concurrency, durationMs };
}
