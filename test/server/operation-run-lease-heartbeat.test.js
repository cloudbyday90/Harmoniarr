import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestJobLease } from '../../testing/server/job-lease-fixtures.js';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';

test('createOperationRunLeaseHeartbeat renews the run lease on start and subsequent ticks', async (t) => {
  const expectedLease = createTestJobLease('import_candidate_execution_planning', 'run-22');
  const captured = { leaseKey: expectedLease.leaseKey, ownerInstanceId: expectedLease.ownerInstanceId, acquisitionId: expectedLease.acquisitionId };
  const renewLease = t.mock.fn(async () => {});
  const runner = createOperationRunLeaseHeartbeat({
    clearIntervalFn: () => {},
    createIntervalHeartbeatRunnerFn: ({ onTick }) => ({
      start() {
        void onTick();
      },
      stop() {},
      tick: onTick,
    }),
    renewLease,
    expectedLease,
    runId: 'run-22',
  });

  runner.start();
  await runner.tick();

  assert.deepEqual(renewLease.mock.calls[0].arguments, [{
    runId: 'run-22',
    status: 'active',
    expectedLease: captured,
  }]);
  assert.deepEqual(renewLease.mock.calls[1].arguments, [{
    runId: 'run-22',
    status: 'active',
    expectedLease: captured,
  }]);
});

test('heartbeat captures its original token and reports ownership loss without borrowing a replacement', async (t) => {
  const lease = createTestJobLease('import_candidate_execution_planning', 'run'); const original = lease.acquisitionId;
  const renewLease = t.mock.fn(async (input) => { assert.equal(input.expectedLease.acquisitionId, original); return null; });
  const heartbeat = createOperationRunLeaseHeartbeat({ runId: 'run', expectedLease: lease, renewLease });
  lease.acquisitionId = createTestJobLease('import_candidate_execution_planning', 'run').acquisitionId;
  assert.deepEqual(await heartbeat.tick(), { skipped: true, reason: 'lease_lost' });
  assert.equal(renewLease.mock.callCount(), 1);
  const missing = createOperationRunLeaseHeartbeat({ runId: 'run', renewLease });
  assert.deepEqual(await missing.tick(), { skipped: true, reason: 'lease_lost' });
  assert.equal(renewLease.mock.callCount(), 1);
});
