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
  const createOperationRun = t.mock.fn(async ({ libraryRoot, status, triggeredByUserId }) => ({
    id: 'run-1',
    libraryRoot,
    status,
    triggeredByUserId,
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

  const result = await service.startLibraryScan({ triggeredByUserId: 'user-7' });

  assert.deepEqual(createOperationRun.mock.calls[0].arguments, [{
    libraryRoot: '/srv/music',
    status: 'pending',
    triggeredByUserId: 'user-7',
  }]);
  assert.deepEqual(result, {
    accepted: true,
    run: {
      id: 'run-1',
      libraryRoot: '/srv/music',
      status: 'pending',
      triggeredByUserId: 'user-7',
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