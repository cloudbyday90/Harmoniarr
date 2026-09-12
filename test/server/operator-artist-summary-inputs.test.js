/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistProjectionService } from '../../src/server/metadata/operator-artist-projection-service.js';

test('compact projection summary preserves orphan and noncanonical explicit-resolution semantics', async () => {
  const groups = [{ id: 'album', primaryType: 'Album', title: 'Album' }, { id: 'single', primaryType: 'Single', title: 'Single' }];
  const releases = [{ id: 'canonical', releaseGroupId: 'album', isCanonical: true, title: 'Canonical' },
    { id: 'alternate', releaseGroupId: 'album', isCanonical: false, title: 'Alternate' }];
  const base = { artist: { id: 'artist' }, aliases: [], detectionEvents: [], detectionEventsPageInfo: { hasMore: false, nextCursor: null } };
  let compactReads = 0;
  const service = createOperatorArtistProjectionService({
    metadataReadService: {
      getArtist: async () => ({ ...base, releaseGroups: groups, releases }),
      getArtistProjectionInputs: async () => {
        compactReads += 1;
        return { ...base, releaseGroups: groups.map(({ id, primaryType }) => ({ id, primaryType })),
          releases: [{ id: 'canonical', releaseGroupId: 'album', isCanonical: true }] };
      },
    },
    getOperatorArtistMonitoring: async () => ({ monitoredReleaseGroupTypes: ['album', 'single'] }),
    getLatestOperatorArtistReconciliationSnapshot: async () => ({ snapshotRevision: 4 }),
    getLatestRunByOperatorArtist: async () => null, getPendingRunByOperatorArtist: async () => null,
    getRunningRunByOperatorArtist: async () => null,
    listOperatorReleaseGroupSelections: async () => [
      { metadataReleaseGroupId: 'album', resolvedMetadataReleaseId: 'alternate', selectionSource: 'manual', selectionState: 'partial' },
      { metadataReleaseGroupId: 'off-catalog', selectionSource: 'manual', selectionState: 'selected' },
    ],
    listOperatorTrackOverrides: async () => [
      { metadataReleaseGroupId: 'album', isDesired: false, remapStatus: 'review_needed' },
      { metadataReleaseGroupId: 'off-catalog', isDesired: true, remapStatus: 'orphaned' },
    ],
    listLibraryReleaseReconciliationsByMetadataReleaseIds: async ({ metadataReleaseIds }) => {
      assert.deepEqual(metadataReleaseIds, ['alternate']);
      return [{ metadataReleaseId: 'alternate', reconciliationStatus: 'duplicate' }];
    },
  });
  const full = await service.getOperatorArtistProjection({ appUserId: 'actor', metadataArtistId: 'artist' });
  assert.equal(compactReads, 0);
  const summary = await service.getOperatorArtistProjection({ appUserId: 'actor', metadataArtistId: 'artist', view: 'summary' });
  assert.equal(compactReads, 1);
  const { releaseGroups: _groups, releases: _releases, ...expected } = full;
  assert.deepEqual(summary, expected);
  assert.equal(summary.operator.overview.orphanedReleaseGroupSelectionCount, 1);
  assert.equal(summary.operator.overview.orphanedTrackOverrideCount, 1);
  assert.equal(summary.operator.overview.reviewNeededTrackOverrideCount, 1);
  assert.equal(summary.operator.coverage.acquiredReleaseCount, 1);
  assert.equal(summary.operator.coverage.duplicateReleaseCount, 1);
  assert.equal(summary.operator.coverage.unresolvedReleaseCount, 1);
});
