import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createScriptReporter,
  formatScriptErrorMessage,
  runDirectScriptTask,
  runScriptTask,
} from '../../scripts/script-runtime.js';

test('formatScriptErrorMessage renders Error instances and plain values', () => {
  assert.equal(formatScriptErrorMessage(new Error('boom')), 'boom');
  assert.equal(formatScriptErrorMessage('plain failure'), 'plain failure');
});

test('createScriptReporter writes prefixed info and error messages', () => {
  const writes = [];
  const reporter = createScriptReporter({
    prefix: 'harmoniarr-test',
    stderr: {
      write(message) {
        writes.push(`stderr:${message}`);
      },
    },
    stdout: {
      write(message) {
        writes.push(`stdout:${message}`);
      },
    },
  });

  reporter.writeInfo('ready');
  reporter.writeError(new Error('failed'));

  assert.deepEqual(writes, [
    'stdout:[harmoniarr-test] ready\n',
    'stderr:[harmoniarr-test] failed\n',
  ]);
});

test('createScriptReporter supports raw stdout output', () => {
  const writes = [];
  const reporter = createScriptReporter({
    prefix: 'harmoniarr-test',
    stdoutStyle: 'raw',
    stdout: {
      write(message) {
        writes.push(message);
      },
    },
  });

  reporter.writeInfo('20260501_120000_example.sql');

  assert.deepEqual(writes, [
    '20260501_120000_example.sql\n',
  ]);
});

test('runScriptTask reports success through the shared reporter', async () => {
  const writes = [];

  await runScriptTask({
    prefix: 'harmoniarr-test',
    renderSuccessMessage: ({ checked }) => `checked ${checked} file(s)`,
    run: async () => ({ checked: 3 }),
    stdout: {
      write(message) {
        writes.push(message);
      },
    },
  });

  assert.deepEqual(writes, [
    '[harmoniarr-test] checked 3 file(s)\n',
  ]);
});

test('runScriptTask reports failures and sets exitCode without throwing', async () => {
  const writes = [];
  const processEmitter = {};

  await runScriptTask({
    prefix: 'harmoniarr-test',
    processEmitter,
    run: async () => {
      throw 'plain failure';
    },
    stderr: {
      write(message) {
        writes.push(message);
      },
    },
  });

  assert.equal(processEmitter.exitCode, 1);
  assert.deepEqual(writes, [
    '[harmoniarr-test] plain failure\n',
  ]);
});

test('runScriptTask validates required dependencies', async () => {
  await assert.rejects(
    () => runScriptTask({
      run: async () => {},
    }),
    /prefix is required/,
  );

  await assert.rejects(
    () => runScriptTask({
      prefix: 'harmoniarr-test',
    }),
    /run is required/,
  );

  await assert.rejects(
    () => runScriptTask({
      prefix: 'harmoniarr-test',
      renderSuccessMessage: 'invalid',
      run: async () => {},
    }),
    /renderSuccessMessage must be a function when provided/,
  );

  assert.throws(
    () => createScriptReporter({
      prefix: 'harmoniarr-test',
      stdoutStyle: 'invalid',
    }),
    /stdoutStyle must be either "prefixed" or "raw"/,
  );
});

test('runDirectScriptTask executes the task for direct entrypoints', async () => {
  const writes = [];

  const didRun = await runDirectScriptTask(
    { main: true, url: 'file:///task.js' },
    {
      prefix: 'harmoniarr-test',
      renderSuccessMessage: ({ checked }) => `checked ${checked} file(s)`,
      run: async () => ({ checked: 2 }),
      stdout: {
        write(message) {
          writes.push(message);
        },
      },
    },
  );

  assert.equal(didRun, true);
  assert.deepEqual(writes, [
    '[harmoniarr-test] checked 2 file(s)\n',
  ]);
});

test('runDirectScriptTask skips imported modules without running the task', async () => {
  let invoked = false;

  const didRun = await runDirectScriptTask(
    { main: false, url: 'file:///task.js' },
    {
      prefix: 'harmoniarr-test',
      run: async () => {
        invoked = true;
      },
    },
  );

  assert.equal(didRun, false);
  assert.equal(invoked, false);
});

test('runDirectScriptTask requires importMeta', async () => {
  await assert.rejects(
    () => runDirectScriptTask(null, {
      prefix: 'harmoniarr-test',
      run: async () => {},
    }),
    /importMeta is required/,
  );
});