import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryReleaseVisibilityService } from '../../src/server/library/library-release-visibility-service.js';

function createTarget(overrides = {}) {
  return {
    artistName: 'Radiohead',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'rg-1',
    metadataReleaseId: 'release-1',
    releaseGroupTitle: 'OK Computer',
    releaseTitle: 'OK Computer',
    ...overrides,
  };
}

test('setLibraryReleaseVisibility rejects requester roles', async () => {
  const service = createLibraryReleaseVisibilityService({
    libraryReleaseVisibilityStore: {
      getLibraryReleaseVisibilityTarget: async () => createTarget(),
      setLibraryReleaseVisibility: async () => ({}),
    },
    recordAuditEventFn: async () => {},
  });

  await assert.rejects(
    () => service.setLibraryReleaseVisibility({
      actorUserId: 'user-1',
      actorUserRole: 'requester',
      metadataReleaseId: 'release-1',
      visibilityState: 'removed',
    }),
    (error) => error?.status === 403 && error?.code === 'forbidden',
  );
});

test('setLibraryReleaseVisibility records non-destructive operator audit evidence', async (t) => {
  const getLibraryReleaseVisibilityTarget = t.mock.fn(async () => createTarget());
  const setLibraryReleaseVisibility = t.mock.fn(async () => ({
    appUserId: 'operator-1',
    metadataReleaseId: 'release-1',
    visibilityState: 'removed',
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createLibraryReleaseVisibilityService({
    libraryReleaseVisibilityStore: {
      getLibraryReleaseVisibilityTarget,
      setLibraryReleaseVisibility,
    },
    recordAuditEventFn,
  });

  const result = await service.setLibraryReleaseVisibility({
    actorUserId: 'operator-1',
    actorUserRole: 'operator',
    metadataReleaseId: 'release-1',
    reason: '  wrong edition  ',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'node-test' },
    visibilityState: 'removed',
  });

  assert.equal(result.visibility.visibilityState, 'removed');
  assert.deepEqual(setLibraryReleaseVisibility.mock.calls[0].arguments[0], {
    appUserId: 'operator-1',
    metadataReleaseId: 'release-1',
    reason: 'wrong edition',
    updatedByUserId: 'operator-1',
    visibilityState: 'removed',
  });
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.deepEqual(recordAuditEventFn.mock.calls[0].arguments[0], {
    actorType: 'app_user',
    actorUserId: 'operator-1',
    details: {
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'rg-1',
      metadataReleaseId: 'release-1',
      reason: 'wrong edition',
      visibilityState: 'removed',
    },
    entityId: 'release-1',
    entityType: 'metadata_release',
    eventType: 'operator_library_release_removed',
    ipAddress: '127.0.0.1',
    summary: 'OK Computer by Radiohead removed from the operator library view',
    userAgent: 'node-test',
  });
});

test('setLibraryReleaseVisibility returns 404 for non-library releases', async () => {
  const service = createLibraryReleaseVisibilityService({
    libraryReleaseVisibilityStore: {
      getLibraryReleaseVisibilityTarget: async () => null,
      setLibraryReleaseVisibility: async () => ({}),
    },
    recordAuditEventFn: async () => {},
  });

  await assert.rejects(
    () => service.setLibraryReleaseVisibility({
      actorUserId: 'operator-1',
      actorUserRole: 'operator',
      metadataReleaseId: 'release-missing',
      visibilityState: 'removed',
    }),
    (error) => error?.status === 404 && error?.code === 'library_release_not_found',
  );
});
