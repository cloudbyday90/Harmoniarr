import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
  formatBufferedCommandFailure,
  formatBufferedCommandTimeoutFailure,
  runBufferedCommand,
} from '../../scripts/process-runtime.js';

function createSpawnStub({
  exitCode = 0,
  hang = false,
  stderr = '',
  stdout = '',
  spawnError = null,
} = {}) {
  const calls = [];
  const killCalls = [];

  function spawnFn(command, args, options) {
    calls.push({ args, command, options });

    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = (signal) => {
      killCalls.push(signal ?? 'SIGTERM');
      queueMicrotask(() => {
        child.emit('close', null);
      });
      return true;
    };

    queueMicrotask(() => {
      if (stdout) {
        child.stdout.emit('data', stdout);
      }

      if (stderr) {
        child.stderr.emit('data', stderr);
      }

      if (spawnError) {
        child.emit('error', spawnError);
        return;
      }

      if (hang) {
        return;
      }

      child.emit('close', exitCode);
    });

    return child;
  }

  return {
    calls,
    killCalls,
    spawnFn,
  };
}

test('formatBufferedCommandFailure includes command, exit code, and output', () => {
  assert.equal(
    formatBufferedCommandFailure({
      args: ['inspect', 'image'],
      command: 'docker',
      exitCode: 2,
      stderr: 'failed',
      stdout: 'partial',
    }),
    'docker inspect image failed with exit code 2\npartial\nfailed',
  );
});

test('formatBufferedCommandTimeoutFailure includes command, timeout, and output', () => {
  assert.equal(
    formatBufferedCommandTimeoutFailure({
      args: ['compose', 'up'],
      command: 'docker',
      stderr: 'still running',
      stdout: 'partial logs',
      timeoutMs: 30000,
    }),
    'docker compose up timed out after 30000ms\npartial logs\nstill running',
  );
});

test('runBufferedCommand captures output for successful commands', async () => {
  const { calls, spawnFn } = createSpawnStub({
    stdout: 'ready',
  });

  const result = await runBufferedCommand({
    args: ['--version'],
    command: 'node',
    cwd: 'C:/repo',
    env: { TEST_ENV: '1' },
    spawnFn,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, 'ready');
  assert.equal(result.stderr, '');
  assert.deepEqual(calls, [{
    args: ['--version'],
    command: 'node',
    options: {
      cwd: 'C:/repo',
      env: { TEST_ENV: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  }]);
});

test('runBufferedCommand throws on unexpected exit codes', async () => {
  const { spawnFn } = createSpawnStub({
    exitCode: 3,
    stderr: 'bad things',
  });

  await assert.rejects(
    () => runBufferedCommand({
      args: ['audit'],
      command: 'npm',
      spawnFn,
    }),
    /npm audit failed with exit code 3\nbad things/,
  );
});

test('runBufferedCommand honors allowed non-zero exit codes', async () => {
  const { spawnFn } = createSpawnStub({
    exitCode: 1,
    stdout: '{}',
  });

  const result = await runBufferedCommand({
    args: ['audit'],
    command: 'npm',
    expectedExitCodes: [0, 1],
    spawnFn,
  });

  assert.equal(result.exitCode, 1);
});

test('runBufferedCommand surfaces spawn errors', async () => {
  const { spawnFn } = createSpawnStub({
    spawnError: new Error('spawn failed'),
  });

  await assert.rejects(
    () => runBufferedCommand({
      command: 'docker',
      spawnFn,
    }),
    /spawn failed/,
  );
});

test('runBufferedCommand kills hung commands when timeout expires', async () => {
  const { killCalls, spawnFn } = createSpawnStub({
    hang: true,
    stdout: 'starting',
  });

  await assert.rejects(
    () => runBufferedCommand({
      args: ['scripts/validate-docker-deployment-path.js'],
      command: 'node',
      spawnFn,
      timeoutMs: 10,
    }),
    /node scripts\/validate-docker-deployment-path\.js timed out after 10ms\nstarting/,
  );

  assert.deepEqual(killCalls, ['SIGTERM']);
});