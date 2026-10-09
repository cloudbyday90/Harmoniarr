import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationHistoryService } from '../../src/server/operation-history-service.js';
import { canRequestOperationRunRetry } from '../../src/shared/operation-run-descriptors.js';

test('operation history preserves a fail-closed public retry flag while omitting private preparation closure records', async () => {
  for (const marker of [{ version: 1, closureId: 'private-closure', epochId: 'private-epoch', lease: 'private-lease' }, null, false, 'malformed', 0]) {
    const row = { id: 'closed-run', operation_type: 'import_candidate_execution_planning', status: 'cancelled',
      summary: { currentStep: 'Download preparation stopped', downloadPreparationClosure: marker,
        downloadPreparationProtocol: { version: 1 } } };
    const original = structuredClone(row);
    const service = createOperationHistoryService({ getPoolFn: () => ({ query: async () => ({ rows: [row] }) }),
      jobLeaseStore: { listLeases: async () => [] }, auditReadService: { listAuditEventsForEntity: async () => [] } });
    const history = await service.buildOperationHistory({ limit: 1 }); const detail = await service.buildOperationRunDetail({ runId: row.id });
    for (const run of [history.runs[0], detail.run]) {
      assert.equal(run.preparationClosed, true); assert.equal(run.status, 'cancelled'); assert.equal(canRequestOperationRunRetry(run), false);
      assert.deepEqual(run.summary, { currentStep: 'Download preparation stopped' });
      assert.doesNotMatch(JSON.stringify(run), /downloadPreparationClosure|downloadPreparationProtocol|private-/u);
    }
    assert.deepEqual(row, original, 'history reads preserve internal closure ownership');
  }
});

test('operation history service lists recent runs across operation types', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempt_count: 1,
      error_message: null,
      cancel_requested_at: null,
      cancel_requested_by_user_id: null,
      cancelled_at: null,
      claimed_at: null,
      claimed_by_instance_id: null,
      finished_at: '2026-05-01T00:20:00.000Z',
      id: 'run-1',
      max_attempts: 2,
      next_attempt_at: '2026-05-01T00:00:00.000Z',
      operation_type: 'library_scan',
      started_at: '2026-05-01T00:00:00.000Z',
      status: 'completed',
      summary: { filesSeen: 42 },
      triggered_by_user_id: 'user-1',
    }],
  }));
  const jobLeaseStore = {
    listLeases: t.mock.fn(async () => [{
      acquiredAt: '2026-05-01T00:00:00.000Z',
      expiresAt: '2026-05-01T00:30:00.000Z',
      heartbeatAt: '2026-05-01T00:05:00.000Z',
      id: 'lease-1',
      jobType: 'library_scan',
      leaseKey: 'library_scan:run-1',
      ownerInstanceId: 'instance-a',
      releasedAt: null,
      state: 'active',
      status: 'active',
    }]),
  };
  const service = createOperationHistoryService({
    getPoolFn: () => ({ query }),
    jobLeaseStore,
  });

  const payload = await service.buildOperationHistory({ limit: 5 });

  assert.equal(query.mock.callCount(), 1);
  assert.equal(query.mock.calls[0].arguments[1][0], 5);
  assert.deepEqual(jobLeaseStore.listLeases.mock.calls[0].arguments, [{
    leaseKeys: ['library_scan:run-1'],
  }]);
  assert.equal(payload.runs[0].operationType, 'library_scan');
  assert.equal(payload.runs[0].attemptCount, 1);
  assert.equal(payload.runs[0].cancelRequestedAt, null);
  assert.equal(payload.runs[0].lease.ownerInstanceId, 'instance-a');
  assert.equal(payload.runs[0].triggeredByUserId, 'user-1');
});

test('operation history service returns run detail with audit events', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempt_count: 2,
      error_message: null,
      cancel_requested_at: '2026-05-01T00:01:00.000Z',
      cancel_requested_by_user_id: 'admin-4',
      cancelled_at: null,
      claimed_at: '2026-05-01T00:00:30.000Z',
      claimed_by_instance_id: 'instance-z',
      finished_at: null,
      id: 'run-9',
      max_attempts: 3,
      next_attempt_at: '2026-05-01T00:00:00.000Z',
      operation_type: 'artwork_cleanup',
      started_at: '2026-05-01T00:00:00.000Z',
      status: 'running',
      summary: { requestedAssetCount: 12 },
      triggered_by_user_id: 'user-7',
    }],
  }));
  const auditReadService = {
    listAuditEventsForEntity: t.mock.fn(async () => [{
      entityId: 'run-9',
      entityType: 'operation_run',
      eventType: 'artwork_cleanup_started',
      id: 'audit-9',
      occurredAt: '2026-05-01T00:00:05.000Z',
      summary: 'Artwork cleanup started',
    }]),
  };
  const jobLeaseStore = {
    listLeases: t.mock.fn(async () => [{
      acquiredAt: '2026-05-01T00:00:00.000Z',
      expiresAt: '2026-05-01T00:30:00.000Z',
      heartbeatAt: '2026-05-01T00:02:00.000Z',
      id: 'lease-9',
      jobType: 'artwork_cleanup',
      leaseKey: 'artwork_cleanup:run-9',
      ownerInstanceId: 'instance-z',
      releasedAt: null,
      state: 'active',
      status: 'active',
    }]),
  };
  const service = createOperationHistoryService({
    auditReadService,
    getPoolFn: () => ({ query }),
    jobLeaseStore,
  });

  const payload = await service.buildOperationRunDetail({ runId: 'run-9', auditLimit: 6 });

  assert.equal(query.mock.callCount(), 1);
  assert.deepEqual(auditReadService.listAuditEventsForEntity.mock.calls[0].arguments, [{
    entityId: 'run-9',
    entityType: 'operation_run',
    limit: 6,
  }]);
  assert.deepEqual(jobLeaseStore.listLeases.mock.calls[0].arguments, [{
    leaseKeys: ['artwork_cleanup:run-9'],
  }]);
  assert.equal(payload.run.operationType, 'artwork_cleanup');
  assert.equal(payload.run.maxAttempts, 3);
  assert.equal(payload.run.cancelRequestedByUserId, 'admin-4');
  assert.equal(payload.run.lease.ownerInstanceId, 'instance-z');
  assert.equal(payload.auditEvents.length, 1);
});

test('operation history service redacts sensitive run summaries and error messages for operator detail reads', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempt_count: 1,
      error_message: 'Import failed while reading /app/data/staging/tmp-7 for admin@example.com',
      cancel_requested_at: null,
      cancel_requested_by_user_id: null,
      cancelled_at: null,
      claimed_at: null,
      claimed_by_instance_id: null,
      finished_at: '2026-05-01T00:20:00.000Z',
      id: 'run-12',
      max_attempts: 2,
      next_attempt_at: '2026-05-01T00:00:00.000Z',
      operation_type: 'library_scan',
      started_at: '2026-05-01T00:00:00.000Z',
      status: 'failed',
      summary: {
        currentStep: 'Scanning /mnt/music/library for import candidates',
        libraryRoot: '/mnt/music/library',
      },
      triggered_by_user_id: 'user-3',
    }],
  }));
  const service = createOperationHistoryService({
    getPoolFn: () => ({ query }),
    jobLeaseStore: {
      listLeases: t.mock.fn(async () => []),
    },
  });

  const payload = await service.buildOperationHistory({ limit: 1 });

  assert.equal(payload.runs[0].errorMessage, 'Import failed while reading [REDACTED_PATH] for [REDACTED_EMAIL]');
  assert.deepEqual(payload.runs[0].summary, {
    currentStep: 'Scanning [REDACTED_PATH] for import candidates',
    libraryRoot: '[REDACTED_PATH]',
  });
});
