import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdempotencyRecordCleanupHeartbeat } from '../../src/server/recovery/idempotency-record-cleanup-heartbeat.js';

test('idempotency record cleanup heartbeat requires deleteExpiredRecords dependency', () => {
  assert.throws(
    () => createIdempotencyRecordCleanupHeartbeat(),
    { message: /deleteExpiredRecords dependency is required/ },
  );
});

test('idempotency record cleanup heartbeat delegates to deleteExpiredRecords on tick', async () => {
  const deleteExpiredRecords = async () => ({ deletedCount: 3 });
  let tickResult = null;

  const heartbeat = createIdempotencyRecordCleanupHeartbeat({
    createIntervalHeartbeatRunnerFn: ({ onTick }) => ({
      start: () => {},
      stop: () => {},
      tick: async () => { tickResult = await onTick(); },
    }),
    deleteExpiredRecords,
    intervalMs: 1000,
  });

  await heartbeat.tick();

  assert.deepEqual(tickResult, { skipped: false, deletedCount: 3 });
});

test('idempotency record cleanup heartbeat skips on error and calls onError', async () => {
  const errors = [];
  const deleteExpiredRecords = async () => { throw new Error('db unavailable'); };
  let tickResult = null;

  const heartbeat = createIdempotencyRecordCleanupHeartbeat({
    createIntervalHeartbeatRunnerFn: ({ onTick }) => ({
      start: () => {},
      stop: () => {},
      tick: async () => { tickResult = await onTick(); },
    }),
    deleteExpiredRecords,
    intervalMs: 1000,
    onError: (error) => { errors.push(error); },
  });

  await heartbeat.tick();

  assert.equal(tickResult.skipped, true);
  assert.equal(tickResult.reason, 'error');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, 'db unavailable');
});

test('idempotency record cleanup heartbeat returns skipped without deletedCount when nothing deleted', async () => {
  const deleteExpiredRecords = async () => ({ deletedCount: 0 });
  let tickResult = null;

  const heartbeat = createIdempotencyRecordCleanupHeartbeat({
    createIntervalHeartbeatRunnerFn: ({ onTick }) => ({
      start: () => {},
      stop: () => {},
      tick: async () => { tickResult = await onTick(); },
    }),
    deleteExpiredRecords,
    intervalMs: 1000,
  });

  await heartbeat.tick();

  assert.deepEqual(tickResult, { skipped: false });
});
