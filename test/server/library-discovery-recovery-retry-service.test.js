import assert from 'node:assert/strict';
import test from 'node:test';

import { createApiError } from '../../src/server/auth.js';
import { createLibraryDiscoveryRecoveryRetryService } from '../../src/server/library/library-discovery-recovery-retry-service.js';

function createDiscoveryRequest(overrides = {}) {
  return {
    blockedReason: null,
    metadataReleaseId: 'release-1',
    requestStatus: 'ready',
    researchAttemptCount: 0,
    searchAttemptCount: 0,
    ...overrides,
  };
}

test('retryDownloadRecoveryDiscoveryRequest resets exhaustion, starts discovery, and audits the action', async (t) => {
  const assertMaintenanceWriteAllowed = t.mock.fn(async () => {});
  const resetDownloadRecoveryExhaustion = t.mock.fn(async () => createDiscoveryRequest());
  const startLibraryDiscoveryRun = t.mock.fn(async () => ({
    accepted: true,
    run: { id: 'run-1', status: 'pending' },
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createLibraryDiscoveryRecoveryRetryService({
    assertMaintenanceWriteAllowed,
    getNow: () => new Date('2026-06-01T12:00:00.000Z'),
    libraryDiscoveryRequestStore: { resetDownloadRecoveryExhaustion },
    recordAuditEventFn,
    startLibraryDiscoveryRun,
  });

  const result = await service.retryDownloadRecoveryDiscoveryRequest({
    metadataReleaseId: ' release-1 ',
    requestMetadata: {
      ipAddress: '203.0.113.5',
      userAgent: 'RetryTest/1.0',
    },
    triggeredByUserId: 'admin-1',
  });

  assert.equal(assertMaintenanceWriteAllowed.mock.callCount(), 1);
  assert.deepEqual(resetDownloadRecoveryExhaustion.mock.calls[0].arguments[0], {
    metadataReleaseId: 'release-1',
    resetAt: '2026-06-01T12:00:00.000Z',
    resetByUserId: 'admin-1',
  });
  assert.deepEqual(startLibraryDiscoveryRun.mock.calls[0].arguments[0], {
    requestMetadata: {
      ipAddress: '203.0.113.5',
      userAgent: 'RetryTest/1.0',
    },
    triggerSource: 'download_recovery_retry',
    triggeredByUserId: 'admin-1',
  });
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'download_recovery_retry_requested');
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].details.runId, 'run-1');
  assert.deepEqual(result, {
    accepted: true,
    discoveryRequest: createDiscoveryRequest(),
    dispatchAlreadyActive: false,
    run: { id: 'run-1', status: 'pending' },
  });
});

test('retryDownloadRecoveryDiscoveryRequest succeeds when discovery dispatch is already active', async (t) => {
  const resetDownloadRecoveryExhaustion = t.mock.fn(async () => createDiscoveryRequest());
  const startLibraryDiscoveryRun = t.mock.fn(async () => {
    throw createApiError(409, 'library_discovery_in_progress', 'Discovery is already running');
  });
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createLibraryDiscoveryRecoveryRetryService({
    libraryDiscoveryRequestStore: { resetDownloadRecoveryExhaustion },
    recordAuditEventFn,
    startLibraryDiscoveryRun,
  });

  const result = await service.retryDownloadRecoveryDiscoveryRequest({
    metadataReleaseId: 'release-1',
  });

  assert.equal(startLibraryDiscoveryRun.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].details.dispatchAlreadyActive, true);
  assert.equal(result.accepted, true);
  assert.equal(result.dispatchAlreadyActive, true);
  assert.equal(result.run, null);
});

test('retryDownloadRecoveryDiscoveryRequest rejects missing metadata release ids', async (t) => {
  const resetDownloadRecoveryExhaustion = t.mock.fn(async () => createDiscoveryRequest());
  const service = createLibraryDiscoveryRecoveryRetryService({
    libraryDiscoveryRequestStore: { resetDownloadRecoveryExhaustion },
    startLibraryDiscoveryRun: async () => ({ run: null }),
  });

  await assert.rejects(
    () => service.retryDownloadRecoveryDiscoveryRequest({ metadataReleaseId: '   ' }),
    { code: 'metadata_release_id_required', status: 400 },
  );
  assert.equal(resetDownloadRecoveryExhaustion.mock.callCount(), 0);
});

test('retryDownloadRecoveryDiscoveryRequest rejects unavailable retry state before dispatch', async (t) => {
  const resetDownloadRecoveryExhaustion = t.mock.fn(async () => null);
  const startLibraryDiscoveryRun = t.mock.fn(async () => ({ run: { id: 'run-1' } }));
  const service = createLibraryDiscoveryRecoveryRetryService({
    libraryDiscoveryRequestStore: { resetDownloadRecoveryExhaustion },
    startLibraryDiscoveryRun,
  });

  await assert.rejects(
    () => service.retryDownloadRecoveryDiscoveryRequest({ metadataReleaseId: 'release-1' }),
    { code: 'download_recovery_retry_unavailable', status: 409 },
  );
  assert.equal(startLibraryDiscoveryRun.mock.callCount(), 0);
});

test('retryDownloadRecoveryDiscoveryRequest checks maintenance write lock before reset', async (t) => {
  const resetDownloadRecoveryExhaustion = t.mock.fn(async () => createDiscoveryRequest());
  const service = createLibraryDiscoveryRecoveryRetryService({
    assertMaintenanceWriteAllowed: async () => {
      throw createApiError(423, 'maintenance_lock_active', 'Maintenance lock active');
    },
    libraryDiscoveryRequestStore: { resetDownloadRecoveryExhaustion },
    startLibraryDiscoveryRun: async () => ({ run: null }),
  });

  await assert.rejects(
    () => service.retryDownloadRecoveryDiscoveryRequest({ metadataReleaseId: 'release-1' }),
    { code: 'maintenance_lock_active', status: 423 },
  );
  assert.equal(resetDownloadRecoveryExhaustion.mock.callCount(), 0);
});
