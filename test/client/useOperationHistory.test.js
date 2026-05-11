import assert from 'node:assert/strict';
import test from 'node:test';
import { useOperationHistory } from '../../src/client/composables/useOperationHistory.js';

test('useOperationHistory loads history and selects the most recent run by default', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({
      checkedAt: '2026-05-01T01:00:00.000Z',
      runs: [{
        id: 'run-1',
        operationType: 'library_scan',
        startedAt: '2026-05-01T00:50:00.000Z',
        status: 'completed',
        summary: {},
      }],
    }),
    fetchOperationRunDetail: async (runId) => ({
      operationRun: {
        auditEvents: [],
        checkedAt: '2026-05-01T01:00:00.000Z',
        run: {
          id: runId,
          operationType: 'library_scan',
          startedAt: '2026-05-01T00:50:00.000Z',
          status: 'completed',
          summary: {},
        },
      },
    }),
  });

  await workflow.loadOperationHistory();

  assert.equal(workflow.runs.value.length, 1);
  assert.equal(workflow.selectedRunId.value, 'run-1');
  assert.equal(workflow.selectedRunDetail.value.run.id, 'run-1');
});

test('useOperationHistory can load a preferred historical run detail explicitly', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({
      checkedAt: '2026-05-01T01:00:00.000Z',
      runs: [{
        id: 'run-latest',
        operationType: 'library_discovery_dispatch',
        startedAt: '2026-05-01T00:55:00.000Z',
        status: 'completed',
        summary: {},
      }],
    }),
    fetchOperationRunDetail: async (runId) => ({
      operationRun: {
        auditEvents: [{ id: 'audit-1', summary: 'Discovery started' }],
        checkedAt: '2026-05-01T01:00:00.000Z',
        run: {
          id: runId,
          operationType: 'library_discovery_dispatch',
          startedAt: '2026-05-01T00:20:00.000Z',
          status: 'failed',
          summary: {},
        },
      },
    }),
  });

  await workflow.loadOperationHistory({ preferredRunId: 'run-older-2' });

  assert.equal(workflow.selectedRunId.value, 'run-older-2');
  assert.equal(workflow.selectedRunDetail.value.run.status, 'failed');
  assert.equal(workflow.detailErrorMessage.value, '');
});

test('useOperationHistory clears stale state when history loading fails', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => {
      throw new Error('operation history unavailable');
    },
  });

  await workflow.loadOperationHistory();

  assert.equal(workflow.historyPayload.value, null);
  assert.equal(workflow.selectedRunId.value, null);
  assert.equal(workflow.errorMessage.value, 'operation history unavailable');
});

test('useOperationHistory requests cancellation and refreshes the selected run detail', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({
      checkedAt: '2026-05-01T01:00:00.000Z',
      runs: [{
        id: 'run-5',
        operationType: 'library_scan',
        startedAt: '2026-05-01T00:50:00.000Z',
        status: 'running',
        summary: {},
      }],
    }),
    fetchOperationRunDetail: async (runId) => ({
      operationRun: {
        auditEvents: [],
        checkedAt: '2026-05-01T01:00:00.000Z',
        run: {
          cancelRequestedAt: '2026-05-01T01:02:00.000Z',
          cancelRequestedByUserId: 'admin-9',
          id: runId,
          operationType: 'library_scan',
          startedAt: '2026-05-01T00:50:00.000Z',
          status: 'running',
          summary: {},
        },
      },
    }),
    requestOperationRunCancellation: async (runId) => ({
      operationRun: {
        cancelRequestedAt: '2026-05-01T01:02:00.000Z',
        cancelRequestedByUserId: 'admin-9',
        id: runId,
        operationType: 'library_scan',
        startedAt: '2026-05-01T00:50:00.000Z',
        status: 'running',
        summary: {},
      },
    }),
  });

  await workflow.loadOperationHistory();
  await workflow.requestCancellation({ runId: 'run-5' });

  assert.equal(workflow.cancellationErrorMessage.value, '');
  assert.equal(workflow.selectedRunDetail.value.run.cancelRequestedByUserId, 'admin-9');
  assert.equal(workflow.runs.value[0].cancelRequestedAt, '2026-05-01T01:02:00.000Z');
});

test('useOperationHistory requests retry and refreshes the selected run detail', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({
      checkedAt: '2026-05-01T01:00:00.000Z',
      runs: [{
        attemptCount: 1,
        id: 'run-6',
        maxAttempts: 1,
        operationType: 'artwork_cleanup',
        startedAt: '2026-05-01T00:50:00.000Z',
        status: 'failed',
        summary: {},
      }],
    }),
    fetchOperationRunDetail: async (runId) => ({
      operationRun: {
        auditEvents: [],
        checkedAt: '2026-05-01T01:00:00.000Z',
        run: {
          attemptCount: 1,
          id: runId,
          maxAttempts: 2,
          nextAttemptAt: '2026-05-01T01:03:00.000Z',
          operationType: 'artwork_cleanup',
          startedAt: '2026-05-01T00:50:00.000Z',
          status: 'pending',
          summary: {},
        },
      },
    }),
    requestOperationRunRetry: async (runId) => ({
      operationRun: {
        attemptCount: 1,
        id: runId,
        maxAttempts: 2,
        nextAttemptAt: '2026-05-01T01:03:00.000Z',
        operationType: 'artwork_cleanup',
        startedAt: '2026-05-01T00:50:00.000Z',
        status: 'pending',
        summary: {},
      },
    }),
  });

  await workflow.loadOperationHistory();
  await workflow.requestRetry({ runId: 'run-6' });

  assert.equal(workflow.retryErrorMessage.value, '');
  assert.equal(workflow.selectedRunDetail.value.run.maxAttempts, 2);
  assert.equal(workflow.runs.value[0].status, 'pending');
});

// ---------------------------------------------------------------------------
// Auto-refresh polling
// ---------------------------------------------------------------------------

function buildTimerMock() {
  let nextId = 1;
  const timers = new Map();
  return {
    setIntervalFn(cb, ms) {
      const id = nextId++;
      timers.set(id, { cb, ms });
      return id;
    },
    clearIntervalFn(id) {
      timers.delete(id);
    },
    get activeCount() { return timers.size; },
    fireAll() {
      for (const { cb } of timers.values()) cb();
    },
  };
}

test('useOperationHistory starts polling when active runs are present after load', async () => {
  const timer = buildTimerMock();
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({
      runs: [{ id: 'run-a', operationType: 'library_scan', status: 'running', summary: {} }],
    }),
    fetchOperationRunDetail: async (runId) => ({ operationRun: { auditEvents: [], run: { id: runId, status: 'running' } } }),
    setIntervalFn: (cb, ms) => timer.setIntervalFn(cb, ms),
    clearIntervalFn: (id) => timer.clearIntervalFn(id),
  });

  await workflow.loadOperationHistory();

  assert.equal(workflow.isPollingActive.value, true);
  assert.equal(timer.activeCount, 1);
});

test('useOperationHistory does not start polling when no active runs exist after load', async () => {
  const timer = buildTimerMock();
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({
      runs: [{ id: 'run-b', operationType: 'library_scan', status: 'completed', summary: {} }],
    }),
    fetchOperationRunDetail: async (runId) => ({ operationRun: { auditEvents: [], run: { id: runId, status: 'completed' } } }),
    setIntervalFn: (cb, ms) => timer.setIntervalFn(cb, ms),
    clearIntervalFn: (id) => timer.clearIntervalFn(id),
  });

  await workflow.loadOperationHistory();

  assert.equal(workflow.isPollingActive.value, false);
  assert.equal(timer.activeCount, 0);
});

test('useOperationHistory stops polling when active runs disappear on next load', async () => {
  const timer = buildTimerMock();
  let callCount = 0;
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => {
      callCount++;
      return {
        runs: [{
          id: 'run-c',
          operationType: 'library_scan',
          status: callCount === 1 ? 'running' : 'completed',
          summary: {},
        }],
      };
    },
    fetchOperationRunDetail: async (runId) => ({ operationRun: { auditEvents: [], run: { id: runId, status: 'completed' } } }),
    setIntervalFn: (cb, ms) => timer.setIntervalFn(cb, ms),
    clearIntervalFn: (id) => timer.clearIntervalFn(id),
  });

  await workflow.loadOperationHistory();
  assert.equal(workflow.isPollingActive.value, true);

  // Second load returns completed run
  await workflow.loadOperationHistory();
  assert.equal(workflow.isPollingActive.value, false);
  assert.equal(timer.activeCount, 0);
});

test('useOperationHistory sets lastRefreshedAt after a successful load', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({ runs: [] }),
  });

  assert.equal(workflow.lastRefreshedAt.value, null);
  await workflow.loadOperationHistory();
  assert.ok(workflow.lastRefreshedAt.value, 'lastRefreshedAt should be set after load');
  assert.doesNotThrow(() => new Date(workflow.lastRefreshedAt.value));
});

test('useOperationHistory does not set lastRefreshedAt when load fails', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => { throw new Error('network error'); },
  });

  await workflow.loadOperationHistory();

  assert.equal(workflow.lastRefreshedAt.value, null);
});

test('useOperationHistory stopPolling sets isPollingActive to false and removes timer', async () => {
  const timer = buildTimerMock();
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({
      runs: [{ id: 'run-d', operationType: 'library_scan', status: 'running', summary: {} }],
    }),
    fetchOperationRunDetail: async (runId) => ({ operationRun: { auditEvents: [], run: { id: runId, status: 'running' } } }),
    setIntervalFn: (cb, ms) => timer.setIntervalFn(cb, ms),
    clearIntervalFn: (id) => timer.clearIntervalFn(id),
  });

  await workflow.loadOperationHistory();
  assert.equal(workflow.isPollingActive.value, true);

  workflow.stopPolling();
  assert.equal(workflow.isPollingActive.value, false);
  assert.equal(timer.activeCount, 0);
});

test('useOperationHistory hasActiveRuns reflects pending and running runs', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({
      runs: [
        { id: 'run-e1', operationType: 'library_scan', status: 'completed', summary: {} },
        { id: 'run-e2', operationType: 'artwork_cleanup', status: 'pending', summary: {} },
      ],
    }),
    fetchOperationRunDetail: async (runId) => ({ operationRun: { auditEvents: [], run: { id: runId, status: 'pending' } } }),
  });

  await workflow.loadOperationHistory();

  assert.equal(workflow.hasActiveRuns.value, true);
});

test('useOperationHistory hasActiveRuns is false when all runs are terminal', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({
      runs: [
        { id: 'run-f1', operationType: 'library_scan', status: 'completed', summary: {} },
        { id: 'run-f2', operationType: 'artwork_cleanup', status: 'failed', summary: {} },
        { id: 'run-f3', operationType: 'artwork_cleanup', status: 'cancelled', summary: {} },
      ],
    }),
    fetchOperationRunDetail: async (runId) => ({ operationRun: { auditEvents: [], run: { id: runId, status: 'completed' } } }),
  });

  await workflow.loadOperationHistory();

  assert.equal(workflow.hasActiveRuns.value, false);
});