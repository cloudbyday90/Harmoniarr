import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createLibraryExternalIntakeService } from '../../src/server/library/library-external-intake-service.js';

test('queueExternalMediaRequestPlanning queues a planning run and patches evidence', async (t) => {
  const run = { id: 'run-1', mediaRequestId: 'req-1', sourceProvider: 'spotify' };
  const createOperationRun = t.mock.fn(async () => run);
  const mergeMediaRequestEvidence = t.mock.fn(async () => {});
  const recordAuditEventFn = t.mock.fn(async () => {});

  const service = createLibraryExternalIntakeService({
    createOperationRun,
    getActiveRunByMediaRequestId: async () => null,
    mediaRequestStore: { mergeMediaRequestEvidence },
    recordAuditEventFn,
  });

  const result = await service.queueExternalMediaRequestPlanning({
    mediaRequestId: 'req-1',
    normalizedSource: {
      canonicalUrl: 'https://open.spotify.com/playlist/abc',
      provider: 'spotify',
      relatedIdentifier: null,
      resourceType: 'playlist',
      sourceIdentifier: 'abc',
      storefront: null,
    },
    triggerSource: 'request_submit',
    triggeredByUserId: 'user-1',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reusedExistingRun, false);
  assert.equal(result.run, run);
  assert.equal(createOperationRun.mock.callCount(), 1);
  assert.equal(createOperationRun.mock.calls[0].arguments[0].queryable, null);
  assert.equal(mergeMediaRequestEvidence.mock.callCount(), 1);
  assert.equal(mergeMediaRequestEvidence.mock.calls[0].arguments[0].queryable, null);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[1], null);
});

test('queueExternalMediaRequestPlanning enlists maintenance, reuse, enqueue, evidence, and audit in the request transaction', async (t) => {
  const queryable = { query: t.mock.fn() };
  const run = { id: 'transaction-run', mediaRequestId: 'transaction-request' };
  const assertMaintenanceWriteAllowed = t.mock.fn(async () => {});
  const getActiveRunByMediaRequestId = t.mock.fn(async () => null);
  const createOperationRun = t.mock.fn(async () => run);
  const mergeMediaRequestEvidence = t.mock.fn(async () => {});
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createLibraryExternalIntakeService({
    assertMaintenanceWriteAllowed,
    createOperationRun,
    getActiveRunByMediaRequestId,
    getNow: () => new Date('2026-09-10T12:00:00Z'),
    mediaRequestStore: { mergeMediaRequestEvidence },
    recordAuditEventFn,
  });

  const result = await service.queueExternalMediaRequestPlanning({
    mediaRequestId: 'transaction-request',
    normalizedSource: {
      canonicalUrl: 'https://open.spotify.com/playlist/abc',
      provider: 'spotify',
      resourceType: 'playlist',
      sourceIdentifier: 'abc',
    },
    queryable,
    triggeredByUserId: 'admin',
  });

  assert.equal(result.run, run);
  assert.deepEqual(assertMaintenanceWriteAllowed.mock.calls[0].arguments, [{ queryable }]);
  assert.deepEqual(getActiveRunByMediaRequestId.mock.calls[0].arguments, ['transaction-request', queryable]);
  assert.equal(createOperationRun.mock.calls[0].arguments[0].queryable, queryable);
  const evidenceWrite = mergeMediaRequestEvidence.mock.calls[0].arguments[0];
  assert.equal(evidenceWrite.queryable, queryable);
  assert.equal(evidenceWrite.evidencePatch.providerAutomation.operationRunId, run.id);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[1], queryable);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].entityId, run.id);
});

test('queueExternalMediaRequestPlanning reuses a run visible in the caller transaction without writing again', async (t) => {
  const queryable = { query: t.mock.fn() };
  const run = { id: 'uncommitted-run', mediaRequestId: 'transaction-request' };
  const createOperationRun = t.mock.fn(async () => {});
  const mergeMediaRequestEvidence = t.mock.fn(async () => {});
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createLibraryExternalIntakeService({
    createOperationRun,
    getActiveRunByMediaRequestId: async (mediaRequestId, transaction) => {
      assert.equal(mediaRequestId, 'transaction-request');
      assert.equal(transaction, queryable);
      return run;
    },
    mediaRequestStore: { mergeMediaRequestEvidence },
    recordAuditEventFn,
  });

  const result = await service.queueExternalMediaRequestPlanning({
    mediaRequestId: 'transaction-request',
    queryable,
  });

  assert.equal(result.reusedExistingRun, true);
  assert.equal(result.run, run);
  assert.equal(createOperationRun.mock.callCount(), 0);
  assert.equal(mergeMediaRequestEvidence.mock.callCount(), 0);
  assert.equal(recordAuditEventFn.mock.callCount(), 0);
});

test('queueExternalMediaRequestPlanning reuses an active run without creating a duplicate', async (t) => {
  const existingRun = { id: 'run-existing', mediaRequestId: 'req-1' };
  const createOperationRun = t.mock.fn(async () => {});
  const recordAuditEventFn = t.mock.fn(async () => {});

  const service = createLibraryExternalIntakeService({
    createOperationRun,
    getActiveRunByMediaRequestId: async () => existingRun,
    recordAuditEventFn,
  });

  const result = await service.queueExternalMediaRequestPlanning({
    mediaRequestId: 'req-1',
    normalizedSource: {
      canonicalUrl: 'https://open.spotify.com/album/xyz',
      provider: 'spotify',
      relatedIdentifier: null,
      resourceType: 'release',
      sourceIdentifier: 'xyz',
      storefront: null,
    },
    triggeredByUserId: 'user-1',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reusedExistingRun, true);
  assert.equal(result.run, existingRun);
  assert.equal(createOperationRun.mock.callCount(), 0);
  assert.equal(recordAuditEventFn.mock.callCount(), 0);
});

test('queueExternalMediaRequestPlanning rejects when maintenance lock blocks unsafe writes', async () => {
  const service = createLibraryExternalIntakeService({
    assertMaintenanceWriteAllowed: async () => {
      throw createApiError(409, 'recovery_lock_conflict', 'A conflicting maintenance lock prevents library external intake planning');
    },
    createOperationRun: async () => {
      throw new Error('createOperationRun should not be called');
    },
    getActiveRunByMediaRequestId: async () => null,
  });

  await assert.rejects(
    () => service.queueExternalMediaRequestPlanning({
      mediaRequestId: 'req-2',
      normalizedSource: {
        canonicalUrl: 'https://open.spotify.com/album/xyz',
        provider: 'spotify',
        resourceType: 'release',
        sourceIdentifier: 'xyz',
      },
    }),
    (error) => error.code === 'recovery_lock_conflict',
  );
});
