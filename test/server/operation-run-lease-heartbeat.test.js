import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';

test('createOperationRunLeaseHeartbeat renews the run lease on start and subsequent ticks', async (t) => {
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
    runId: 'run-22',
  });

  runner.start();
  await runner.tick();

  assert.deepEqual(renewLease.mock.calls[0].arguments, [{
    runId: 'run-22',
    status: 'active',
  }]);
  assert.deepEqual(renewLease.mock.calls[1].arguments, [{
    runId: 'run-22',
    status: 'active',
  }]);
});