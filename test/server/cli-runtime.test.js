import assert from 'node:assert/strict';
import test from 'node:test';
import { runCliTask } from '../../src/server/cli-runtime.js';

test('runCliTask runs the task, reports success through the caller, and always cleans up', async () => {
  const events = [];

  await runCliTask({
    cleanup: async () => {
      events.push('cleanup');
    },
    onSuccess: async (result) => {
      events.push(`success:${result}`);
    },
    reporter: {
      writeError() {
        events.push('error');
      },
    },
    run: async () => {
      events.push('run');
      return 'done';
    },
  });

  assert.deepEqual(events, [
    'run',
    'success:done',
    'cleanup',
  ]);
});

test('runCliTask writes the default error report, sets exitCode, and still cleans up on failure', async () => {
  const events = [];
  const processEmitter = {};

  await runCliTask({
    cleanup: async () => {
      events.push('cleanup');
    },
    processEmitter,
    reporter: {
      writeError(error) {
        events.push(`error:${error.message}`);
      },
    },
    run: async () => {
      throw new Error('boom');
    },
  });

  assert.equal(processEmitter.exitCode, 1);
  assert.deepEqual(events, [
    'error:boom',
    'cleanup',
  ]);
});

test('runCliTask allows a caller-specific error handler', async () => {
  const events = [];
  const processEmitter = {};

  await runCliTask({
    cleanup: async () => {
      events.push('cleanup');
    },
    onError: async (error) => {
      events.push(`custom-error:${error}`);
    },
    processEmitter,
    reporter: {
      writeError() {
        events.push('default-error');
      },
    },
    run: async () => {
      throw 'plain failure';
    },
  });

  assert.equal(processEmitter.exitCode, 1);
  assert.deepEqual(events, [
    'custom-error:plain failure',
    'cleanup',
  ]);
});

test('runCliTask validates required dependencies', async () => {
  await assert.rejects(
    () => runCliTask({
      reporter: {
        writeError() {},
      },
    }),
    /run is required/,
  );

  await assert.rejects(
    () => runCliTask({
      run: async () => {},
    }),
    /reporter.writeError is required/,
  );
});