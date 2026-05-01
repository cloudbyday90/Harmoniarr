import assert from 'node:assert/strict';
import test from 'node:test';
import { createRuntimeReporter, formatRuntimeErrorMessage } from '../../src/server/runtime-reporter.js';

test('formatRuntimeErrorMessage renders Error instances and unknown thrown values', () => {
  assert.equal(formatRuntimeErrorMessage(new Error('boom')), 'boom');
  assert.equal(formatRuntimeErrorMessage('plain failure'), 'plain failure');
  assert.equal(formatRuntimeErrorMessage({ detail: 'nope' }), '[object Object]');
});

test('createRuntimeReporter writes prefixed info and error lines', () => {
  const stdoutWrites = [];
  const stderrWrites = [];
  const runtimeReporter = createRuntimeReporter({
    prefix: 'harmoniarr',
    stderr: {
      write(message) {
        stderrWrites.push(message);
      },
    },
    stdout: {
      write(message) {
        stdoutWrites.push(message);
      },
    },
  });

  runtimeReporter.writeInfo('listening on 0.0.0.0:3000');
  runtimeReporter.writeError(new Error('server already closed'), { label: 'shutdown error' });
  runtimeReporter.writeError('plain failure');

  assert.deepEqual(stdoutWrites, [
    '[harmoniarr] listening on 0.0.0.0:3000\n',
  ]);
  assert.deepEqual(stderrWrites, [
    '[harmoniarr] shutdown error: server already closed\n',
    '[harmoniarr] plain failure\n',
  ]);
});

test('createRuntimeReporter requires a prefix', () => {
  assert.throws(() => {
    createRuntimeReporter();
  }, /prefix is required/);
});