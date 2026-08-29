/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { suite, test } from 'node:test';
import {
  buildBrowserTestNodeArguments,
  defaultBrowserTestConcurrency,
  parseBrowserTestConcurrency,
  runBrowserTests,
} from '../../scripts/browser-test-runner.js';

suite('browser test runner', () => {
  test('uses the approved two-worker default', () => {
    assert.equal(parseBrowserTestConcurrency([]), defaultBrowserTestConcurrency);
    assert.equal(defaultBrowserTestConcurrency, 2);
  });

  test('accepts one positive concurrency override and rejects ambiguous input', () => {
    assert.equal(parseBrowserTestConcurrency(['--concurrency=1']), 1);
    assert.throws(() => parseBrowserTestConcurrency(['--concurrency=0']), /positive integer/);
    assert.throws(() => parseBrowserTestConcurrency(['--concurrency=2', '--verbose']), /Only --concurrency/);
    assert.throws(() => parseBrowserTestConcurrency(['--workers=2']), /Only --concurrency/);
  });

  test('builds an isolated Node test command with a deterministic completion boundary', () => {
    assert.deepEqual(buildBrowserTestNodeArguments(2), [
      '--test',
      '--test-force-exit',
      '--test-concurrency=2',
      'test/browser/**/*.test.js',
    ]);
  });

  test('runs the Node test child with inherited output and returns resolved concurrency and duration', async () => {
    const child = new EventEmitter();
    let nodeArguments = null;
    let nodePath = null;
    let options = null;
    const pending = runBrowserTests({
      args: ['--concurrency=1'],
      cwd: 'workspace-root',
      now: () => 100,
      nodePath: 'node-under-test',
      spawnChild(receivedNodePath, receivedNodeArguments, receivedOptions) {
        nodePath = receivedNodePath;
        nodeArguments = receivedNodeArguments;
        options = receivedOptions;
        return child;
      },
    });

    child.emit('exit', 0, null);

    assert.deepEqual(await pending, { concurrency: 1, durationMs: 0 });
    assert.equal(nodePath, 'node-under-test');
    assert.deepEqual(nodeArguments, buildBrowserTestNodeArguments(1));
    assert.deepEqual(options, {
      cwd: 'workspace-root',
      stdio: 'inherit',
      windowsHide: true,
    });
  });

  test('fails when the test child exits unsuccessfully', async () => {
    const child = new EventEmitter();
    const pending = runBrowserTests({
      spawnChild() {
        return child;
      },
    });

    child.emit('exit', 1, null);

    await assert.rejects(pending, /Browser tests exited with code 1/);
  });

  test('records bounded evidence after an isolated browser run without exposing child output', async () => {
    const child = new EventEmitter();
    const evidenceWrites = [];
    let cleanupInput = null;
    let clock = 0;
    const pending = runBrowserTests({
      env: {
        HARMONIARR_BROWSER_TEST_CLEANUP_WAIT_MS: '25000',
        HARMONIARR_BROWSER_TEST_EVIDENCE_PATH: 'artifacts/browser-test.json',
      },
      now: () => {
        clock += 42;
        return clock;
      },
      spawnChild() {
        return child;
      },
      waitForCleanup: async (input) => {
        cleanupInput = input;
        return {
          attempts: 1,
          browserTestProcessCount: 0,
          maxWaitMs: 25_000,
          status: 'clean',
          testcontainerCount: 0,
        };
      },
      writeEvidence: async (input) => {
        evidenceWrites.push(input);
      },
    });

    child.emit('exit', 0, null);

    assert.deepEqual(await pending, { concurrency: 2, durationMs: 42 });
    assert.deepEqual(cleanupInput, {
      cwd: process.cwd(),
      maxWaitMs: 25_000,
    });
    assert.deepEqual(evidenceWrites, [{
      browserTest: {
        durationMs: 42,
        status: 'passed',
        workerCount: 2,
      },
      cleanup: {
        attempts: 1,
        browserTestProcessCount: 0,
        maxWaitMs: 25_000,
        status: 'clean',
        testcontainerCount: 0,
      },
      cwd: process.cwd(),
      evidencePath: 'artifacts/browser-test.json',
    }]);
  });

  test('preserves a test failure after collecting evidence', async () => {
    const child = new EventEmitter();
    let evidenceStatus = null;
    const pending = runBrowserTests({
      env: {
        HARMONIARR_BROWSER_TEST_EVIDENCE_PATH: 'artifacts/browser-test.json',
      },
      spawnChild() {
        return child;
      },
      waitForCleanup: async () => ({
        attempts: 1,
        browserTestProcessCount: 0,
        maxWaitMs: 25_000,
        status: 'clean',
        testcontainerCount: 0,
      }),
      writeEvidence: async ({ browserTest }) => {
        evidenceStatus = browserTest.status;
      },
    });

    child.emit('exit', 1, null);

    await assert.rejects(pending, /Browser tests exited with code 1/u);
    assert.equal(evidenceStatus, 'failed');
  });

  test('preserves a test failure when writing evidence also fails', async () => {
    const child = new EventEmitter();
    const pending = runBrowserTests({
      env: {
        HARMONIARR_BROWSER_TEST_EVIDENCE_PATH: 'artifacts/browser-test.json',
      },
      spawnChild() {
        return child;
      },
      waitForCleanup: async () => ({
        attempts: 1,
        browserTestProcessCount: 0,
        maxWaitMs: 25_000,
        status: 'clean',
        testcontainerCount: 0,
      }),
      writeEvidence: async () => {
        throw new Error('evidence write failed');
      },
    });

    child.emit('exit', 1, null);

    await assert.rejects(pending, /Browser tests exited with code 1/u);
  });
});
