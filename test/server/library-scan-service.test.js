import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createLibraryScanService } from '../../src/server/library/library-scan-service.js';

test('createLibraryScanService blocks new runs when shared path validation is not healthy', async () => {
  const service = createLibraryScanService({
    createOperationRun: async () => {
      throw new Error('createOperationRun should not be called');
    },
    getActiveRun: async () => null,
    settingsService: {
      buildSettingsPayload: async () => ({
        settings: {
          paths: {
            music: '/srv/music',
          },
        },
        pathValidation: {
          summary: {
            status: 'degraded',
            message: 'Validation needs attention',
          },
        },
      }),
    },
  });

  await assert.rejects(
    () => service.startLibraryScan({ triggeredByUserId: 'user-1' }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'library_scan_not_ready');
      return true;
    },
  );
});

test('createLibraryScanService persists a pending run for durable dispatch when paths are ready', async (t) => {
  const createOperationRun = t.mock.fn(async ({
    libraryRoot,
    status,
    triggeredByRunId,
    triggeredByUserId,
    triggerReason,
  }) => ({
    id: 'run-1',
    libraryRoot,
    status,
    triggeredByRunId,
    triggeredByUserId,
    triggerReason,
  }));
  const service = createLibraryScanService({
    createOperationRun,
    getActiveRun: async () => null,
    recordAuditEventFn: async () => {},
    settingsService: {
      buildSettingsPayload: async () => ({
        settings: {
          paths: {
            music: '/srv/music',
          },
        },
        pathValidation: {
          summary: {
            status: 'healthy',
            message: 'Validated',
          },
        },
      }),
    },
  });

  const result = await service.startLibraryScan({
    releaseHints: [{
      canonicalPath: '/srv/music/Autechre/Amber/01 Foil.flac',
      metadataReleaseId: 'release-1',
    }],
    triggeredByRunId: 'apply-run-1',
    triggeredByUserId: 'user-7',
    triggerReason: 'import_candidate_apply',
  });

  assert.deepEqual(createOperationRun.mock.calls[0].arguments, [{
    libraryRoot: '/srv/music',
    releaseHints: [{
      canonicalPath: '/srv/music/Autechre/Amber/01 Foil.flac',
      metadataReleaseId: 'release-1',
    }],
    status: 'pending',
    triggeredByRunId: 'apply-run-1',
    triggeredByUserId: 'user-7',
    triggerReason: 'import_candidate_apply',
  }]);
  assert.deepEqual(result, {
    accepted: true,
    run: {
      id: 'run-1',
      libraryRoot: '/srv/music',
      status: 'pending',
      triggeredByRunId: 'apply-run-1',
      triggeredByUserId: 'user-7',
      triggerReason: 'import_candidate_apply',
    },
  });
});

test('createLibraryScanService queues a deferred pending run without checking active scan state', async (t) => {
  const getActiveRun = t.mock.fn(async () => ({ id: 'running-scan-1', status: 'running' }));
  const createOperationRun = t.mock.fn(async (input) => ({
    id: 'deferred-scan-1',
    ...input,
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createLibraryScanService({
    createOperationRun,
    getActiveRun,
    recordAuditEventFn,
    settingsService: {
      buildSettingsPayload: async () => ({
        settings: {
          paths: {
            music: '/srv/music',
          },
        },
        pathValidation: {
          summary: {
            status: 'healthy',
            message: 'Validated',
          },
        },
      }),
    },
  });

  const result = await service.queueDeferredLibraryScan({
    deferredReason: 'library_scan_in_progress',
    releaseHints: [{
      canonicalPath: '/srv/music/Autechre/Amber/01 Foil.flac',
      metadataReleaseId: 'release-1',
    }],
    triggeredByRunId: 'apply-run-1',
    triggerReason: 'import_candidate_apply',
  });

  assert.equal(getActiveRun.mock.callCount(), 0);
  assert.deepEqual(createOperationRun.mock.calls[0].arguments[0], {
    deferredReason: 'library_scan_in_progress',
    libraryRoot: '/srv/music',
    releaseHints: [{
      canonicalPath: '/srv/music/Autechre/Amber/01 Foil.flac',
      metadataReleaseId: 'release-1',
    }],
    status: 'pending',
    triggeredByRunId: 'apply-run-1',
    triggeredByUserId: null,
    triggerReason: 'import_candidate_apply',
  });
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].summary, 'Library scan queued');
  assert.deepEqual(result, {
    accepted: true,
    run: {
      deferredReason: 'library_scan_in_progress',
      id: 'deferred-scan-1',
      libraryRoot: '/srv/music',
      releaseHints: [{
        canonicalPath: '/srv/music/Autechre/Amber/01 Foil.flac',
        metadataReleaseId: 'release-1',
      }],
      status: 'pending',
      triggeredByRunId: 'apply-run-1',
      triggeredByUserId: null,
      triggerReason: 'import_candidate_apply',
    },
  });
});

test('createLibraryScanService rejects when maintenance lock blocks unsafe writes', async () => {
  const service = createLibraryScanService({
    assertMaintenanceWriteAllowed: async () => {
      throw createApiError(409, 'recovery_lock_conflict', 'A conflicting maintenance lock prevents library scan');
    },
    settingsService: {
      buildSettingsPayload: async () => ({
        settings: {
          paths: {
            music: '/srv/music',
          },
        },
        pathValidation: {
          summary: {
            status: 'healthy',
            message: 'Validated',
          },
        },
      }),
    },
  });

  await assert.rejects(
    () => service.startLibraryScan(),
    (error) => error.code === 'recovery_lock_conflict',
  );
});
