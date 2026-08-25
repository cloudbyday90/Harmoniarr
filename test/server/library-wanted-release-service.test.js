/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLibraryWantedReleaseProjection } from '../../src/server/library/library-wanted-release-projection-service.js';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';

function buildArtistPayload() {
  return {
    artist: { id: 'artist-1' },
    releaseGroups: [
      { id: 'group-policy', primaryType: 'album', title: 'Policy album' },
      { id: 'group-manual', primaryType: 'single', title: 'Manual single' },
      { id: 'group-complete', primaryType: 'album', title: 'Complete album' },
    ],
    releases: [
      {
        id: 'release-policy',
        isCanonical: true,
        releaseDate: '2028-06-01',
        releaseGroupId: 'group-policy',
        status: 'Official',
        title: 'Policy album',
        trackCount: 10,
      },
      {
        id: 'release-manual',
        isCanonical: true,
        releaseDate: '2016',
        releaseGroupId: 'group-manual',
        status: 'Official',
        title: 'Manual single',
        trackCount: 4,
      },
      {
        id: 'release-complete',
        isCanonical: true,
        releaseDate: '2028-09-01',
        releaseGroupId: 'group-complete',
        status: 'Official',
        title: 'Complete album',
        trackCount: 12,
      },
    ],
  };
}

test('wanted-release projection uses effective desired state and retains explicit selections under manual-only automation', () => {
  const wantedReleases = buildLibraryWantedReleaseProjection({
    appUserId: 'user-1',
    artistPayload: buildArtistPayload(),
    libraryReleaseReconciliations: [
      {
        expectedTrackCount: 12,
        matchedTrackCount: 12,
        metadataReleaseId: 'release-complete',
        reconciliationStatus: 'complete',
      },
    ],
    monitoring: {
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album'],
      releaseScope: 'track_only',
      wantedAutomationMode: 'manual_only',
    },
    releaseGroupSelections: [{
      metadataReleaseGroupId: 'group-manual',
      resolvedMetadataReleaseId: 'release-manual',
      selectionOrigin: 'manual_inclusion',
      selectionSource: 'manual',
      selectionState: 'selected',
    }],
  });

  assert.deepEqual(wantedReleases, [{
    appUserId: 'user-1',
    evidence: {
      monitoredReleaseGroupTypes: ['album'],
      reconciliationStatus: 'missing',
      releaseScope: 'track_only',
      selectionOrigin: 'manual_inclusion',
      selectionSource: 'manual',
      selectionState: 'selected',
      strategy: 'explicit_release_gap',
      wantedAutomationMode: 'manual_only',
    },
    expectedTrackCount: 4,
    matchedTrackCount: 0,
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'group-manual',
    metadataReleaseId: 'release-manual',
    missingTrackCount: 4,
    releaseDate: '2016-01-01',
    releaseStatus: 'Official',
    wantedStatus: 'missing',
  }]);
});

test('wanted-release projection retains eligible policy selections and reports partial coverage from reconciliation', () => {
  const wantedReleases = buildLibraryWantedReleaseProjection({
    appUserId: 'user-1',
    artistPayload: buildArtistPayload(),
    libraryReleaseReconciliations: [{
      expectedTrackCount: 10,
      matchedTrackCount: 7,
      metadataReleaseId: 'release-policy',
      reconciliationStatus: 'partial',
    }, {
      expectedTrackCount: 12,
      matchedTrackCount: 12,
      metadataReleaseId: 'release-complete',
      reconciliationStatus: 'complete',
    }],
    monitoring: {
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album'],
      releaseScope: 'current_and_future',
      wantedAutomationMode: 'current_and_future_matching',
    },
  });

  assert.equal(wantedReleases.length, 1);
  assert.deepEqual(wantedReleases[0], {
    appUserId: 'user-1',
    evidence: {
      monitoredReleaseGroupTypes: ['album'],
      reconciliationStatus: 'partial',
      releaseScope: 'current_and_future',
      selectionOrigin: null,
      selectionSource: 'policy',
      selectionState: 'selected',
      strategy: 'monitored_release_gap',
      wantedAutomationMode: 'current_and_future_matching',
    },
    expectedTrackCount: 10,
    matchedTrackCount: 7,
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'group-policy',
    metadataReleaseId: 'release-policy',
    missingTrackCount: 3,
    releaseDate: '2028-06-01',
    releaseStatus: 'Official',
    wantedStatus: 'partial',
  });
});

test('reconcileWantedReleases reads each monitored artist through injected read boundaries', async (t) => {
  const replaceLibraryWantedReleases = t.mock.fn(async () => {});
  const listReconciliations = t.mock.fn(async ({ metadataReleaseIds }) => {
    assert.deepEqual(metadataReleaseIds.sort(), [
      'release-complete',
      'release-manual',
      'release-policy',
    ]);
    return [{
      expectedTrackCount: 12,
      matchedTrackCount: 12,
      metadataReleaseId: 'release-complete',
      reconciliationStatus: 'complete',
    }];
  });
  const service = createLibraryWantedReleaseService({
    getMetadataArtist: async ({ artistId }) => {
      assert.equal(artistId, 'artist-1');
      return buildArtistPayload();
    },
    libraryWantedReleaseStore: { replaceLibraryWantedReleases },
    listLibraryReleaseReconciliationsByMetadataReleaseIds: listReconciliations,
    listOperatorArtistMonitoringSnapshot: async () => [{
      appUserId: 'user-1',
      isMonitored: true,
      metadataArtistId: 'artist-1',
      monitoredReleaseGroupTypes: ['album'],
      releaseScope: 'current_and_future',
      wantedAutomationMode: 'current_and_future_matching',
    }],
    listOperatorReleaseGroupSelections: async ({ appUserId, metadataArtistId }) => {
      assert.equal(appUserId, 'user-1');
      assert.equal(metadataArtistId, 'artist-1');
      return [];
    },
    listOperatorTrackOverrides: async ({ appUserId, metadataArtistId }) => {
      assert.equal(appUserId, 'user-1');
      assert.equal(metadataArtistId, 'artist-1');
      return [];
    },
  });

  await service.reconcileWantedReleases();

  assert.equal(listReconciliations.mock.calls.length, 1);
  assert.deepEqual(replaceLibraryWantedReleases.mock.calls[0].arguments[0], {
    wantedReleases: [{
      appUserId: 'user-1',
      evidence: {
        monitoredReleaseGroupTypes: ['album'],
        reconciliationStatus: 'missing',
        releaseScope: 'current_and_future',
        selectionOrigin: null,
        selectionSource: 'policy',
        selectionState: 'selected',
        strategy: 'monitored_release_absent',
        wantedAutomationMode: 'current_and_future_matching',
      },
      expectedTrackCount: 10,
      matchedTrackCount: 0,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'group-policy',
      metadataReleaseId: 'release-policy',
      missingTrackCount: 10,
      releaseDate: '2028-06-01',
      releaseStatus: 'Official',
      wantedStatus: 'missing',
    }],
  });
});

test('reconcileWantedReleases clears stale wanted releases when no monitored artists remain', async (t) => {
  const replaceLibraryWantedReleases = t.mock.fn(async () => {});
  const service = createLibraryWantedReleaseService({
    libraryWantedReleaseStore: { replaceLibraryWantedReleases },
    listOperatorArtistMonitoringSnapshot: async () => [],
  });

  await service.reconcileWantedReleases();

  assert.deepEqual(replaceLibraryWantedReleases.mock.calls[0].arguments[0], {
    wantedReleases: [],
  });
});

test('reconcileWantedReleases tolerates a metadata artist removed during the projection run', async (t) => {
  const replaceLibraryWantedReleases = t.mock.fn(async () => {});
  const missingArtistError = Object.assign(new Error('Metadata artist was not found: artist-1'), {
    code: 'metadata_not_found',
    status: 404,
  });
  const service = createLibraryWantedReleaseService({
    getMetadataArtist: async () => {
      throw missingArtistError;
    },
    libraryWantedReleaseStore: { replaceLibraryWantedReleases },
    listOperatorArtistMonitoringSnapshot: async () => [{
      appUserId: 'user-1',
      isMonitored: true,
      metadataArtistId: 'artist-1',
    }],
    listOperatorReleaseGroupSelections: async () => [],
    listOperatorTrackOverrides: async () => [],
  });

  await service.reconcileWantedReleases();

  assert.deepEqual(replaceLibraryWantedReleases.mock.calls[0].arguments[0], {
    wantedReleases: [],
  });
});
