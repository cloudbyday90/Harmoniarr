import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerOperationsRoutes } from '../../src/server/routes/operations-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createOperationsRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerOperationsRoutes(app, {
      buildOperationHistory: async () => ({ checkedAt: '2026-05-01T01:00:00.000Z', runs: [] }),
      buildOperationRunDetail: async ({ runId }) => ({
        auditEvents: [],
        checkedAt: '2026-05-01T01:05:00.000Z',
        run: {
          id: runId,
          operationType: 'library_scan',
          status: 'completed',
          summary: {},
        },
      }),
      requestOperationRunCancellation: async ({ runId }) => ({
        id: runId,
        operationType: 'library_scan',
        cancelRequestedAt: '2026-05-01T01:10:00.000Z',
        cancelRequestedByUserId: 'user-1',
        cancelledAt: null,
        status: 'running',
        summary: {},
      }),
      requestOperationRunRetry: async ({ runId }) => ({
        attemptCount: 1,
        id: runId,
        maxAttempts: 2,
        nextAttemptAt: '2026-05-01T01:20:00.000Z',
        operationType: 'library_scan',
        status: 'pending',
        summary: {},
      }),
      requireAdminSession: async () => ({ appUserId: 'user-1' }),
      requireCsrf: () => {},
      requireFreshAdminSession: async () => ({ appUserId: 'user-1' }),
      ...overrides,
    });
  });
}

test('operations history route requires an admin session and returns the shared payload', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'user-3' }));
  const buildOperationHistory = t.mock.fn(async ({ limit }) => ({
    checkedAt: '2026-05-01T01:00:00.000Z',
    runs: [{ id: 'run-1', operationType: 'library_scan', status: 'completed', summary: {} }],
    requestedLimit: limit,
  }));
  const app = createOperationsRouteTestApp({ buildOperationHistory, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/operations/history?limit=7`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.deepEqual(buildOperationHistory.mock.calls[0].arguments, [{ limit: 7 }]);
    assert.equal(payload.runs[0].id, 'run-1');
  });
});

test('operations run detail route requires an admin session and returns the selected run payload', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'user-4' }));
  const buildOperationRunDetail = t.mock.fn(async ({ auditLimit, runId }) => ({
    auditEvents: [{ id: 'audit-1', summary: 'Started' }],
    checkedAt: '2026-05-01T01:05:00.000Z',
    run: {
      id: runId,
      operationType: 'artwork_cleanup',
      status: 'running',
      summary: {},
    },
    requestedAuditLimit: auditLimit,
  }));
  const app = createOperationsRouteTestApp({ buildOperationRunDetail, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/operations/runs/run-44?auditLimit=5`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.deepEqual(buildOperationRunDetail.mock.calls[0].arguments, [{ auditLimit: 5, runId: 'run-44' }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.operationRun.run.id, 'run-44');
  });
});

test('operations routes preserve shared api errors from the detail service', async () => {
  const app = createOperationsRouteTestApp({
    buildOperationRunDetail: async () => {
      throw createApiError(404, 'operation_run_not_found', 'Operation run not found');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/operations/runs/run-missing`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.error.code, 'operation_run_not_found');
  });
});

test('operations cancel route requires a fresh admin session and returns the updated run payload', async (t) => {
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-7' }));
  const requireCsrf = t.mock.fn(() => {});
  const requestOperationRunCancellation = t.mock.fn(async ({ runId, requestedByUserId }) => ({
    id: runId,
    operationType: 'library_scan',
    cancelRequestedAt: '2026-05-01T01:10:00.000Z',
    cancelRequestedByUserId: requestedByUserId,
    cancelledAt: null,
    status: 'running',
    summary: {},
  }));
  const app = createOperationsRouteTestApp({
    requestOperationRunCancellation,
    requireCsrf,
    requireFreshAdminSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/operations/runs/run-77/cancel`, {
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(requestOperationRunCancellation.mock.calls[0].arguments, [{
      requestedByUserId: 'admin-7',
      runId: 'run-77',
    }]);
    assert.equal(payload.operationRun.cancelRequestedByUserId, 'admin-7');
  });
});

test('operations retry route requires a fresh admin session and returns the updated run payload', async (t) => {
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-7' }));
  const requireCsrf = t.mock.fn(() => {});
  const requestOperationRunRetry = t.mock.fn(async ({ runId, requestedByUserId }) => ({
    attemptCount: 1,
    id: runId,
    maxAttempts: 2,
    nextAttemptAt: '2026-05-01T01:20:00.000Z',
    operationType: 'library_scan',
    requestedByUserId,
    status: 'pending',
    summary: {},
  }));
  const app = createOperationsRouteTestApp({
    requestOperationRunRetry,
    requireCsrf,
    requireFreshAdminSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/operations/runs/run-77/retry`, {
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(requestOperationRunRetry.mock.calls[0].arguments, [{
      requestedByUserId: 'admin-7',
      runId: 'run-77',
    }]);
    assert.equal(payload.operationRun.maxAttempts, 2);
  });
});