import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryExternalRequestDiscoveryWorker } from '../../src/server/library/library-external-request-discovery-worker.js';
import { createOperationRunCancellationError, createOperationRunPauseError } from '../../src/server/operation-run-cancellation.js';
import { canRequestOperationRunRetry } from '../../src/shared/operation-run-descriptors.js';

function createFixture(t, discoverExternalRequestRelease) {
  let releaseDone;
  const released = new Promise((resolve) => { releaseDone = resolve; });
  const heartbeat = { start: t.mock.fn(), stop: t.mock.fn() };
  const dependencies = {
    acquireLease: t.mock.fn(async () => {}),
    createOperationRunLeaseHeartbeatFn: () => heartbeat,
    discoverExternalRequestRelease: t.mock.fn(discoverExternalRequestRelease),
    isCancellationRequested: async () => false,
    markRunCancelled: t.mock.fn(async () => {}),
    markRunCompleted: t.mock.fn(async () => {}),
    markRunFailed: t.mock.fn(async () => {}),
    markRunPaused: t.mock.fn(async () => {}),
    markRunStarted: t.mock.fn(async () => {}),
    releaseLease: t.mock.fn(async (args) => { releaseDone(args); }),
    renewLease: async () => {},
  };
  return { dependencies, heartbeat, released, worker: createLibraryExternalRequestDiscoveryWorker(dependencies) };
}

const args = { intentId: 'intent', mediaRequestId: 'request', runId: 'run', triggeredByUserId: 'admin' };

test('external discovery worker completes search as import review without auto-download', async (t) => {
  const fixture = createFixture(t, async () => ({ candidateCount: 2, fileCount: 8, searchId: 'search' }));
  await fixture.worker.startWorkerRun(args);
  assert.deepEqual(await fixture.released, { runId: 'run', status: 'completed' });
  assert.deepEqual(fixture.dependencies.discoverExternalRequestRelease.mock.calls[0].arguments[0], { intentId: 'intent', mediaRequestId: 'request', operationRunId: 'run', triggeredByUserId: 'admin' });
  assert.equal(fixture.dependencies.markRunCompleted.mock.calls[0].arguments[0].summary.currentStep, 'Candidates ready for import review');
  assert.equal(fixture.heartbeat.start.mock.callCount(), 1);
  assert.equal(fixture.heartbeat.stop.mock.callCount(), 1);
});

for (const scenario of ['cancelled', 'paused', 'failed']) {
  test(`external discovery worker records ${scenario} and releases its lease`, async (t) => {
    const error = scenario === 'cancelled' ? createOperationRunCancellationError()
      : scenario === 'paused' ? createOperationRunPauseError({ pauseCode: 'recovery_lock_conflict', nextRetryAt: '2026-09-10T00:00:00Z' })
        : new Error('Provider details with confidential data');
    const fixture = createFixture(t, async () => { throw error; });
    await fixture.worker.startWorkerRun(args);
    assert.deepEqual(await fixture.released, { runId: 'run', status: scenario });
    assert.equal(fixture.dependencies.markRunCompleted.mock.callCount(), 0);
    assert.equal(fixture.dependencies.markRunCancelled.mock.callCount(), scenario === 'cancelled' ? 1 : 0);
    assert.equal(fixture.dependencies.markRunPaused.mock.callCount(), scenario === 'paused' ? 1 : 0);
    assert.equal(fixture.dependencies.markRunFailed.mock.callCount(), scenario === 'failed' ? 1 : 0);
    if (scenario === 'failed') assert.equal(JSON.stringify(fixture.dependencies.markRunFailed.mock.calls).includes('confidential'), false);
    if (scenario === 'paused') assert.equal(fixture.dependencies.markRunPaused.mock.calls[0].arguments[0].nextAttemptAt, '2026-09-10T00:00:00Z');
    assert.equal(fixture.heartbeat.stop.mock.callCount(), 1);
  });
}

test('duplicate in-process starts execute one discovery run', async (t) => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const fixture = createFixture(t, async () => { await pending; return { candidateCount: 1, fileCount: 1 }; });
  await fixture.worker.startWorkerRun(args);
  await fixture.worker.startWorkerRun(args);
  finish();
  await fixture.released;
  assert.equal(fixture.dependencies.acquireLease.mock.callCount(), 1);
  assert.equal(fixture.dependencies.discoverExternalRequestRelease.mock.callCount(), 1);
});

test('an empty discovery result remains actionable through explicit background-job retry', async (t) => {
  const fixture = createFixture(t, async () => ({ candidateCount: 0, fileCount: 0 }));
  await fixture.worker.startWorkerRun(args);
  assert.deepEqual(await fixture.released, { runId: 'run', status: 'failed' });
  const failure = fixture.dependencies.markRunFailed.mock.calls[0].arguments[0];
  assert.match(failure.summary.currentStep, /No candidates found/);
  assert.equal(failure.summary.failureCode, 'external_request_discovery_no_candidates');
  assert.equal(fixture.dependencies.markRunCompleted.mock.callCount(), 0);
  assert.equal(canRequestOperationRunRetry({ operationType: 'library_external_request_discovery', status: 'failed' }), true);
});

test('a worker cannot release or fail another worker’s active lease', async (t) => {
  const fixture = createFixture(t, async () => assert.fail('Another worker owns this run'));
  fixture.dependencies.acquireLease.mock.mockImplementation(async () => { throw Object.assign(new Error('Lease unavailable'), { code: 'operation_run_lease_unavailable' }); });
  await fixture.worker.startWorkerRun(args);
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(fixture.dependencies.releaseLease.mock.callCount(), 0);
  assert.equal(fixture.dependencies.markRunFailed.mock.callCount(), 0);
});
