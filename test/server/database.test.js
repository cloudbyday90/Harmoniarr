import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
  attachPoolErrorHandler,
  isIgnorablePoolShutdownError,
} from '../../src/server/database.js';

class FakePool extends EventEmitter {}

function createStderrDouble() {
  const writes = [];
  return {
    writes,
    write(message) {
      writes.push(message);
    },
  };
}

test('isIgnorablePoolShutdownError recognizes administrator-command termination', () => {
  assert.equal(
    isIgnorablePoolShutdownError(new Error('terminating connection due to administrator command')),
    true,
  );
});

test('attachPoolErrorHandler suppresses expected idle-client shutdown errors while closing', () => {
  const pool = new FakePool();
  const stderr = createStderrDouble();
  const runtimeState = { closing: true };

  attachPoolErrorHandler(pool, { runtimeState, stderr });
  pool.emit('error', new Error('terminating connection due to administrator command'));

  assert.deepEqual(stderr.writes, []);
});

test('attachPoolErrorHandler logs unexpected idle-client errors', () => {
  const pool = new FakePool();
  const stderr = createStderrDouble();
  const runtimeState = { closing: false };

  attachPoolErrorHandler(pool, { runtimeState, stderr });
  pool.emit('error', new Error('unexpected idle client failure'));

  assert.equal(stderr.writes.length, 1);
  assert.match(stderr.writes[0], /unexpected idle client failure/);
});
