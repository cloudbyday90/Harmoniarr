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
    pollIntervalMs: 0,
  });

  await workflow.loadOperationHistory();

  assert.equal(workflow.runs.value.length, 1);
  assert.equal(workflow.selectedRunId.value, 'run-1');
  assert.equal(workflow.selectedRunDetail.value.run.id, 'run-1');
  workflow.destroy();
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
    pollIntervalMs: 0,
  });

  await workflow.loadOperationHistory({ preferredRunId: 'run-older-2' });

  assert.equal(workflow.selectedRunId.value, 'run-older-2');
  assert.equal(workflow.selectedRunDetail.value.run.status, 'failed');
  assert.equal(workflow.detailErrorMessage.value, '');
  workflow.destroy();
});

test('useOperationHistory clears stale state when history loading fails', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => {
      throw new Error('operation history unavailable');
    },
    pollIntervalMs: 0,
  });

  await workflow.loadOperationHistory();

  assert.equal(workflow.historyPayload.value, null);
  assert.equal(workflow.selectedRunId.value, null);
  assert.equal(workflow.errorMessage.value, 'operation history unavailable');
  workflow.destroy();
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
    pollIntervalMs: 0,
  });

  await workflow.loadOperationHistory();
  await workflow.requestCancellation({ runId: 'run-5' });

  assert.equal(workflow.cancellationErrorMessage.value, '');
  assert.equal(workflow.selectedRunDetail.value.run.cancelRequestedByUserId, 'admin-9');
  assert.equal(workflow.runs.value[0].cancelRequestedAt, '2026-05-01T01:02:00.000Z');
  workflow.destroy();
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
    pollIntervalMs: 0,
  });

  await workflow.loadOperationHistory();
  await workflow.requestRetry({ runId: 'run-6' });

  assert.equal(workflow.retryErrorMessage.value, '');
  assert.equal(workflow.selectedRunDetail.value.run.maxAttempts, 2);
  assert.equal(workflow.runs.value[0].status, 'pending');
  workflow.destroy();
});

test('useOperationHistory isPollingActive is true when active runs are present after load', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({
      runs: [{ id: 'run-a', operationType: 'library_scan', status: 'running', summary: {} }],
    }),
    fetchOperationRunDetail: async (runId) => ({ operationRun: { auditEvents: [], run: { id: runId, status: 'running' } } }),
    pollIntervalMs: 50,
  });

  await workflow.loadOperationHistory();

  assert.equal(workflow.isPollingActive.value, true);
  workflow.destroy();
});

test('useOperationHistory isPollingActive is false when no active runs exist after load', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({
      runs: [{ id: 'run-b', operationType: 'library_scan', status: 'completed', summary: {} }],
    }),
    fetchOperationRunDetail: async (runId) => ({ operationRun: { auditEvents: [], run: { id: runId, status: 'completed' } } }),
    pollIntervalMs: 50,
  });

  await workflow.loadOperationHistory();

  assert.equal(workflow.isPollingActive.value, false);
  workflow.destroy();
});

test('useOperationHistory stops polling when active runs disappear on next load', async () => {
  let callCount = 0;
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => {
      callCount += 1;
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
    pollIntervalMs: 0,
  });

  await workflow.loadOperationHistory();
  assert.equal(workflow.isPollingActive.value, false);

  await workflow.loadOperationHistory();
  assert.equal(workflow.isPollingActive.value, false);
  workflow.destroy();
});

test('useOperationHistory sets lastRefreshedAt after a successful load', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({ runs: [] }),
    pollIntervalMs: 0,
  });

  assert.equal(workflow.lastRefreshedAt.value, null);
  await workflow.loadOperationHistory();
  assert.ok(workflow.lastRefreshedAt.value, 'lastRefreshedAt should be set after load');
  assert.doesNotThrow(() => new Date(workflow.lastRefreshedAt.value));
  workflow.destroy();
});

test('useOperationHistory does not set lastRefreshedAt when load fails', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => { throw new Error('network error'); },
    pollIntervalMs: 0,
  });

  await workflow.loadOperationHistory();

  assert.equal(workflow.lastRefreshedAt.value, null);
  workflow.destroy();
});

test('useOperationHistory destroy sets isPollingActive to false', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({
      runs: [{ id: 'run-d', operationType: 'library_scan', status: 'running', summary: {} }],
    }),
    fetchOperationRunDetail: async (runId) => ({ operationRun: { auditEvents: [], run: { id: runId, status: 'running' } } }),
    pollIntervalMs: 50,
  });

  await workflow.loadOperationHistory();
  assert.equal(workflow.isPollingActive.value, true);

  workflow.destroy();
  assert.equal(workflow.isPollingActive.value, false);
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
    pollIntervalMs: 0,
  });

  await workflow.loadOperationHistory();

  assert.equal(workflow.hasActiveRuns.value, true);
  workflow.destroy();
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
    pollIntervalMs: 0,
  });

  await workflow.loadOperationHistory();

  assert.equal(workflow.hasActiveRuns.value, false);
  workflow.destroy();
});

test('useOperationHistory revalidate preserves stale data on error', async () => {
  let callCount = 0;
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => {
      callCount += 1;
      if (callCount === 1) {
        return { runs: [{ id: 'run-g', status: 'running', summary: {} }] };
      }
      throw new Error('refresh failed');
    },
    fetchOperationRunDetail: async () => ({ operationRun: { auditEvents: [], run: { id: 'run-g', status: 'running' } } }),
    pollIntervalMs: 0,
  });

  await workflow.loadOperationHistory();
  assert.equal(workflow.runs.value.length, 1);

  await workflow.revalidate();
  assert.equal(workflow.runs.value.length, 1, 'stale data preserved on revalidation error');
  workflow.destroy();
});

test('useOperationHistory revalidate is no-op after destroy', async () => {
  let callCount = 0;
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => {
      callCount += 1;
      return { runs: [] };
    },
    pollIntervalMs: 0,
  });

  await workflow.loadOperationHistory();
  assert.equal(callCount, 1);
  workflow.destroy();

  await workflow.revalidate();
  assert.equal(callCount, 1, 'no fetch after destroy');
});

test('useOperationHistory isRevalidating is true during background revalidation', async () => {
  const workflow = useOperationHistory({
    fetchOperationHistory: async () => ({ runs: [{ id: 'run-h', status: 'running', summary: {} }] }),
    fetchOperationRunDetail: async (runId) => ({ operationRun: { auditEvents: [], run: { id: runId, status: 'running' } } }),
    pollIntervalMs: 0,
  });

  await workflow.loadOperationHistory();
  assert.equal(workflow.isRevalidating.value, false);

  const p = workflow.revalidate();
  assert.equal(workflow.isRevalidating.value, true);
  await p;
  assert.equal(workflow.isRevalidating.value, false);
  workflow.destroy();
});
