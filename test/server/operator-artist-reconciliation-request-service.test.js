import assert from 'node:assert/strict';
import test from 'node:test';

import { createOperatorArtistReconciliationRequestService } from '../../src/server/metadata/operator-artist-reconciliation-request-service.js';

test('materializeDesiredReleaseRequests creates requests for eligible releases and reconciles discovery once', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const client = {
    query,
    release: t.mock.fn(() => {}),
  };
  const connect = t.mock.fn(async () => client);
  const createMediaRequest = t.mock.fn(async ({ matchedMetadataReleaseId, queryable }) => {
    assert.equal(queryable, client);
    return {
      id: `request-for-${matchedMetadataReleaseId}`,
    };
  });
  const insertMediaRequestEvent = t.mock.fn(async ({ mediaRequestId, queryable }) => {
    assert.equal(queryable, client);
    assert.match(mediaRequestId, /^request-for-/);
  });
  const reconcileDiscoveryRequests = t.mock.fn(async () => {});

  const service = createOperatorArtistReconciliationRequestService({
    createMediaRequest,
    findActiveDuplicateRequest: async () => null,
    getPoolFn: () => ({ connect }),
    insertMediaRequestEvent,
    reconcileDiscoveryRequests,
  });

  const result = await service.materializeDesiredReleaseRequests({
    appUserId: 'user-1',
    artistName: 'Autechre',
    desiredReleases: [{
      eligibleForDownstreamWork: true,
      isExplicitSelection: false,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'group-1',
      metadataReleaseId: 'release-1',
      musicbrainzReleaseId: 'mb-release-1',
      releaseDate: '2026-06-01',
      releaseGroupTitle: 'Amber',
      releaseTitle: 'Amber',
      selectionState: 'selected',
    }, {
      eligibleForDownstreamWork: true,
      isExplicitSelection: true,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'group-1',
      metadataReleaseId: 'release-1',
      musicbrainzReleaseId: 'mb-release-1',
      releaseDate: '2026-06-01',
      releaseGroupTitle: 'Amber',
      releaseTitle: 'Amber',
      selectionState: 'partial',
    }, {
      eligibleForDownstreamWork: false,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'group-2',
      metadataReleaseId: 'release-2',
      releaseGroupTitle: 'Anti',
      releaseTitle: 'Anti',
      selectionState: 'selected',
    }],
    snapshotId: 'snapshot-1',
    snapshotRevision: 3,
  });

  assert.equal(result.createdRequestCount, 1);
  assert.deepEqual(result.createdRequestIds, ['request-for-release-1']);
  assert.equal(result.discoveryReconciled, true);
  assert.equal(result.duplicateSuppressedCount, 0);
  assert.equal(result.skippedRequestCount, 1);
  assert.equal(connect.mock.callCount(), 1);
  assert.equal(createMediaRequest.mock.callCount(), 1);
  assert.equal(insertMediaRequestEvent.mock.callCount(), 1);
  assert.equal(reconcileDiscoveryRequests.mock.callCount(), 1);

  const executedSql = query.mock.calls.map((call) => call.arguments[0]);
  assert.ok(executedSql.includes('BEGIN'));
  assert.ok(executedSql.includes('COMMIT'));
  assert.ok(executedSql.some((sql) => sql.includes('pg_advisory_xact_lock')));
});

test('materializeDesiredReleaseRequests suppresses duplicates after acquiring the advisory lock', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const client = {
    query,
    release: t.mock.fn(() => {}),
  };
  const createMediaRequest = t.mock.fn(async () => {
    throw new Error('createMediaRequest should not run for duplicates');
  });
  const service = createOperatorArtistReconciliationRequestService({
    createMediaRequest,
    findActiveDuplicateRequest: async ({ queryable }) => {
      assert.equal(queryable, client);
      return { id: 'existing-request-1' };
    },
    getPoolFn: () => ({
      connect: async () => client,
    }),
    insertMediaRequestEvent: async () => {
      throw new Error('insertMediaRequestEvent should not run for duplicates');
    },
    reconcileDiscoveryRequests: async () => {
      throw new Error('reconcileDiscoveryRequests should not run when nothing is created');
    },
  });

  const result = await service.materializeDesiredReleaseRequests({
    appUserId: 'user-1',
    artistName: 'Autechre',
    desiredReleases: [{
      eligibleForDownstreamWork: true,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'group-1',
      metadataReleaseId: 'release-1',
      musicbrainzReleaseId: 'mb-release-1',
      releaseGroupTitle: 'Amber',
      releaseTitle: 'Amber',
      selectionState: 'selected',
    }],
    snapshotId: 'snapshot-1',
    snapshotRevision: 3,
  });

  assert.equal(result.createdRequestCount, 0);
  assert.equal(result.duplicateSuppressedCount, 1);
  assert.equal(result.discoveryReconciled, false);
  assert.equal(createMediaRequest.mock.callCount(), 0);

  const executedSql = query.mock.calls.map((call) => call.arguments[0]);
  assert.ok(executedSql.includes('BEGIN'));
  assert.ok(executedSql.includes('ROLLBACK'));
  assert.ok(executedSql.some((sql) => sql.includes('pg_advisory_xact_lock')));
});
