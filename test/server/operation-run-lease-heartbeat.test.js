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
  assert.equal(heartbeat.signal.aborted, true);
  assert.equal(heartbeat.signal.reason.code, 'operation_run_lease_lost');
  const first = heartbeat.signal.reason; await heartbeat.tick(); assert.equal(heartbeat.signal.reason, first);
  const missing = createOperationRunLeaseHeartbeat({ runId: 'run', renewLease });
  assert.deepEqual(await missing.tick(), { skipped: true, reason: 'lease_lost' });
  assert.equal(renewLease.mock.callCount(), 2);
  assert.equal(missing.signal.reason.code, 'operation_run_lease_lost');
});

test('terminal heartbeat close drains admitted renewal and refuses timer restart', async () => {
  const gate = Promise.withResolvers();
  const entered = Promise.withResolvers();
  let renewals = 0;
  const heartbeat = createOperationRunLeaseHeartbeat({
    expectedLease: createTestJobLease('import_candidate_apply', 'held'), runId: 'held',
    renewLease: async () => { renewals += 1; entered.resolve(); await gate.promise; },
  });
  heartbeat.start();
  await entered.promise;
  const closing = heartbeat.stopAndDrain();
  assert.strictEqual(heartbeat.stopAndDrain(), closing);
  try {
    assert.deepEqual(await heartbeat.tick(), { skipped: true, reason: 'stopped' });
    assert.throws(() => heartbeat.start(), { code: 'heartbeat_closing' });
    assert.equal(renewals, 1);
  } finally { gate.resolve(); await closing; }
  assert.equal(heartbeat.signal.aborted, false);
});

test('heartbeat callback rejection is observed and retained for terminal close', async () => {
  const failure = new Error('reporter failed');
  const heartbeat = createOperationRunLeaseHeartbeat({
    expectedLease: createTestJobLease('import_candidate_apply', 'failed'), runId: 'failed',
    renewLease: async () => { throw new Error('renewal failed'); },
    onError: async () => { throw failure; },
  });
  assert.deepEqual(await heartbeat.tick(), { skipped: true, reason: 'error' });
  await assert.rejects(heartbeat.stopAndDrain(), error => error === failure);
});

for (const reason of [new Error('renewal unavailable'), null]) {
  test(`heartbeat signals original ${reason === null ? 'null' : 'Error'} before held error reporting and drains it`, async () => {
    const entered = Promise.withResolvers(); const release = Promise.withResolvers();
    const heartbeat = createOperationRunLeaseHeartbeat({ expectedLease: createTestJobLease('import_candidate_apply', 'failed'), runId: 'failed',
      renewLease: async () => { throw reason; }, onError: async error => { assert.equal(error, reason); entered.resolve(); await release.promise; },
    });
    const ticking = heartbeat.tick(); await entered.promise;
    assert.equal(heartbeat.signal.aborted, true); assert.equal(heartbeat.signal.reason, reason);
    let closed = false; const closing = heartbeat.stopAndDrain().then(() => { closed = true; });
    await new Promise(resolve => { setImmediate(resolve); }); assert.equal(closed, false);
    release.resolve(); assert.deepEqual(await ticking, { reason: 'error', skipped: true }); await closing;
  });
}
