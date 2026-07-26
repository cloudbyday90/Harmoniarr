import assert from 'node:assert/strict';
import test from 'node:test';

import { createApiError } from '../../src/server/auth.js';
import { createLibraryDiscoveryFolderSetupRecoveryService } from '../../src/server/library/library-discovery-folder-setup-recovery-service.js';

function createSettings(overrides = {}) {
  return {
    library: {
      discoveryBatchSize: 5,
    },
    ...overrides,
  };
}

test('recoverAfterValidatedFolderSetup releases one bounded batch and starts one discovery run', async (t) => {
  const releaseFolderSetupBlockedAutomaticDiscoveryRequests = t.mock.fn(async () => 3);
  const startLibraryDiscoveryRun = t.mock.fn(async () => ({
    accepted: true,
    run: { id: 'run-1', status: 'pending' },
  }));
  const service = createLibraryDiscoveryFolderSetupRecoveryService({
    getNow: () => new Date('2026-07-26T15:00:00.000Z'),
    libraryDiscoveryRequestStore: { releaseFolderSetupBlockedAutomaticDiscoveryRequests },
    startLibraryDiscoveryRun,
  });

  const result = await service.recoverAfterValidatedFolderSetup({
    actorUserId: 'admin-1',
    requestMetadata: { ipAddress: '203.0.113.10', userAgent: 'FolderSetupTest/1.0' },
    settings: createSettings({ library: { discoveryBatchSize: 3 } }),
  });

  assert.deepEqual(releaseFolderSetupBlockedAutomaticDiscoveryRequests.mock.calls[0].arguments[0], {
    limit: 3,
    releasedAt: '2026-07-26T15:00:00.000Z',
  });
  assert.deepEqual(startLibraryDiscoveryRun.mock.calls[0].arguments[0], {
    requestMetadata: { ipAddress: '203.0.113.10', userAgent: 'FolderSetupTest/1.0' },
    triggerSource: 'folder_setup_recovery',
    triggeredByUserId: 'admin-1',
  });
  assert.deepEqual(result, {
    dispatchAlreadyActive: false,
    dispatchDeferred: false,
    releasedCount: 3,
    runStarted: true,
  });
});

test('recoverAfterValidatedFolderSetup does not start discovery when no request is eligible', async (t) => {
  const startLibraryDiscoveryRun = t.mock.fn(async () => ({ run: { id: 'run-1' } }));
  const service = createLibraryDiscoveryFolderSetupRecoveryService({
    libraryDiscoveryRequestStore: {
      releaseFolderSetupBlockedAutomaticDiscoveryRequests: async () => 0,
    },
    startLibraryDiscoveryRun,
  });

  const result = await service.recoverAfterValidatedFolderSetup({ settings: createSettings() });

  assert.deepEqual(result, {
    dispatchAlreadyActive: false,
    dispatchDeferred: false,
    releasedCount: 0,
    runStarted: false,
  });
  assert.equal(startLibraryDiscoveryRun.mock.callCount(), 0);
});

test('recoverAfterValidatedFolderSetup leaves released work for the heartbeat when dispatch is already active', async (t) => {
  const service = createLibraryDiscoveryFolderSetupRecoveryService({
    libraryDiscoveryRequestStore: {
      releaseFolderSetupBlockedAutomaticDiscoveryRequests: async () => 1,
    },
    startLibraryDiscoveryRun: async () => {
      throw createApiError(409, 'library_discovery_in_progress', 'Discovery is already running');
    },
  });

  const result = await service.recoverAfterValidatedFolderSetup({ settings: createSettings() });

  assert.deepEqual(result, {
    dispatchAlreadyActive: true,
    dispatchDeferred: true,
    releasedCount: 1,
    runStarted: false,
  });
});
