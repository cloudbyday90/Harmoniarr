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

  runtimeReporter.writeInfo('listening on /app/data/runtime.sock for ops@example.com');
  runtimeReporter.writeError(new Error('server already closed at /app/data/runtime.sock for ops@example.com'), { label: 'shutdown error' });
  runtimeReporter.writeError('plain failure token=abc123');
  runtimeReporter.writeWarning('memory pressure detected while scanning /mnt/music/library');

  assert.deepEqual(stdoutWrites, [
    '[harmoniarr] listening on [REDACTED_PATH] for [REDACTED_EMAIL]\n',
  ]);
  assert.deepEqual(stderrWrites, [
    '[harmoniarr] shutdown error: server already closed at [REDACTED_PATH] for [REDACTED_EMAIL]\n',
    '[harmoniarr] plain failure token=[REDACTED]\n',
    '[harmoniarr] warning: memory pressure detected while scanning [REDACTED_PATH]\n',
  ]);
});

test('createRuntimeReporter requires a prefix', () => {
  assert.throws(() => {
    createRuntimeReporter();
  }, /prefix is required/);
});
