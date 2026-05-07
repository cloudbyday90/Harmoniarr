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
import { createReleaseGroupTracklistService } from '../../../src/server/metadata/release-group-tracklist-service.js';

function makeReleaseRow(overrides = {}) {
  return {
    id: 'release-1',
    musicbrainz_release_id: 'mb-release-1',
    title: 'Substrata',
    release_date: '1997-01-24',
    country: 'NO',
    status: 'Official',
    track_count: 10,
    medium_count: 1,
    barcode: null,
    disambiguation: null,
    is_canonical: true,
    ...overrides,
  };
}

function makeMediumRow(overrides = {}) {
  return {
    id: 'medium-1',
    position: 1,
    title: null,
    format: 'CD',
    track_count: 10,
    ...overrides,
  };
}

function makeTrackRow(overrides = {}) {
  return {
    metadata_medium_id: 'medium-1',
    position: 1,
    number_text: '1',
    title: 'Poa Alpina',
    length_ms: 300000,
    recording_length_ms: null,
    artist_credit: 'Biosphere',
    recording_artist_credit: null,
    recording_musicbrainz_recording_id: 'mbr-1',
    recording_id: null,
    ...overrides,
  };
}

function makePool({ releaseGroup = null, releases = [], media = [], tracks = [], ownership = null, ownedRecordings = [], requestState = null } = {}) {
  let queryCount = 0;
  const responses = [];

  // getMetadataReleaseGroupByMusicBrainzReleaseGroupId
  responses.push({ rows: releaseGroup ? [releaseGroup] : [] });
  if (releaseGroup) {
    // listReleasesWithCanonicalByReleaseGroupId
    responses.push({ rows: releases });
    if (releases.length > 0) {
      // listMetadataMediaByReleaseId, listMetadataTracksByReleaseId, getOwnership — called via Promise.all
      responses.push({ rows: media });       // media
      responses.push({ rows: tracks });      // tracks
      responses.push({ rows: ownership ? [ownership] : [] }); // ownership
      if (ownership && ownership.matched_track_count > 0) {
        responses.push({ rows: ownedRecordings }); // getOwnedRecordingIds
      }
      // getRequestState
      responses.push({ rows: requestState ? [requestState] : [] });
    }
  }

  return {
    query: async () => {
      const result = responses[queryCount] ?? { rows: [] };
      queryCount++;
      return result;
    },
  };
}

/** A no-op catalog service stub that should never be called in local-path tests. */
const noMbCatalogService = {
  getReleaseGroupReleases: async () => { throw new Error('musicBrainzCatalogService should not be called in this test'); },
};

// ── Local path ────────────────────────────────────────────────────────────────

test('getReleaseGroupTracklist returns local tracklist for an imported release group', async () => {
  const releaseGroup = { id: 'rg-1' };
  const releaseRow = makeReleaseRow();
  const mediumRow = makeMediumRow();
  const trackRow = makeTrackRow();
  const pool = makePool({ releaseGroup, releases: [releaseRow], media: [mediumRow], tracks: [trackRow] });

  const service = createReleaseGroupTracklistService({ getPoolFn: async () => pool, musicBrainzCatalogService: noMbCatalogService });
  const result = await service.getReleaseGroupTracklist({ releaseGroupMbid: 'mb-rg-1', sessionUserId: 'user-1' });

  assert.equal(result.source, 'local');
  assert.deepEqual(result.release, {
    id: 'release-1',
    musicbrainzReleaseId: 'mb-release-1',
    title: 'Substrata',
    releaseDate: '1997-01-24',
    country: 'NO',
    status: 'Official',
    trackCount: 10,
    mediumCount: 1,
    barcode: null,
    disambiguation: null,
    isCanonical: true,
  });
  assert.equal(result.media.length, 1);
  assert.equal(result.media[0].tracks.length, 1);
  assert.equal(result.media[0].tracks[0].title, 'Poa Alpina');
  assert.equal(result.ownership, null);
  assert.deepEqual(result.allReleases, [result.release]);
  assert.equal(result.requestState, null);
});

test('getReleaseGroupTracklist marks owned tracks when ownership has matched_track_count > 0', async () => {
  const releaseGroup = { id: 'rg-1' };
  const releaseRow = makeReleaseRow();
  const mediumRow = makeMediumRow();
  const trackRow = makeTrackRow({ recording_id: 'recording-1' });
  const ownershipRow = {
    reconciliation_status: 'complete',
    expected_track_count: 10,
    matched_track_count: 10,
  };
  const ownedRecording = { metadata_recording_id: 'recording-1' };
  const pool = makePool({
    releaseGroup,
    releases: [releaseRow],
    media: [mediumRow],
    tracks: [trackRow],
    ownership: ownershipRow,
    ownedRecordings: [ownedRecording],
  });

  const service = createReleaseGroupTracklistService({ getPoolFn: async () => pool, musicBrainzCatalogService: noMbCatalogService });
  const result = await service.getReleaseGroupTracklist({ releaseGroupMbid: 'mb-rg-1', sessionUserId: 'user-1' });

  assert.equal(result.ownership.matchedTrackCount, 10);
  assert.equal(result.media[0].tracks[0].isOwned, true);
});

test('getReleaseGroupTracklist selects release matching preferReleaseMbid', async () => {
  const releaseGroup = { id: 'rg-1' };
  const releaseA = makeReleaseRow({ id: 'r-a', musicbrainz_release_id: 'mb-r-a', is_canonical: true });
  const releaseB = makeReleaseRow({ id: 'r-b', musicbrainz_release_id: 'mb-r-b', is_canonical: false });
  const pool = makePool({ releaseGroup, releases: [releaseA, releaseB], media: [], tracks: [] });

  const service = createReleaseGroupTracklistService({ getPoolFn: async () => pool, musicBrainzCatalogService: noMbCatalogService });
  const result = await service.getReleaseGroupTracklist({
    releaseGroupMbid: 'mb-rg-1',
    preferReleaseMbid: 'mb-r-b',
    sessionUserId: null,
  });

  assert.equal(result.release.id, 'r-b');
});

test('getReleaseGroupTracklist falls through to MB when release group not in local DB', async () => {
  const pool = makePool({ releaseGroup: null });
  const mbReleases = [
    {
      musicbrainzReleaseId: 'mb-r-1',
      title: 'Substrata',
      releaseDate: '1997-01-24',
      country: 'NO',
      status: 'Official',
      trackCount: 10,
      mediumCount: 1,
      barcode: null,
      disambiguation: null,
    },
  ];
  const musicBrainzCatalogService = {
    getReleaseGroupReleases: async () => ({ results: mbReleases }),
  };

  const service = createReleaseGroupTracklistService({
    getPoolFn: async () => pool,
    musicBrainzCatalogService,
  });

  const result = await service.getReleaseGroupTracklist({
    releaseGroupMbid: 'mb-rg-unknown',
    sessionUserId: null,
  });

  assert.equal(result.source, 'musicbrainz');
  assert.equal(result.release.musicbrainzReleaseId, 'mb-r-1');
  assert.equal(result.release.id, null);
  assert.equal(result.media.length, 0);
  assert.equal(result.ownership, null);
  assert.equal(result.allReleases.length, 1);
  assert.equal(result.requestState, null);
});

test('getReleaseGroupTracklist returns empty musicbrainz result when MB has no releases', async () => {
  const pool = makePool({ releaseGroup: null });
  const musicBrainzCatalogService = {
    getReleaseGroupReleases: async () => ({ results: [] }),
  };

  const service = createReleaseGroupTracklistService({
    getPoolFn: async () => pool,
    musicBrainzCatalogService,
  });

  const result = await service.getReleaseGroupTracklist({
    releaseGroupMbid: 'mb-rg-ghost',
    sessionUserId: null,
  });

  assert.equal(result.source, 'musicbrainz');
  assert.equal(result.release, null);
  assert.deepEqual(result.media, []);
  assert.deepEqual(result.allReleases, []);
});

test('getReleaseGroupTracklist fires background import when on MB fallback path', async (t) => {
  const pool = makePool({ releaseGroup: null });
  const musicBrainzCatalogService = {
    getReleaseGroupReleases: async () => ({
      results: [
        {
          musicbrainzReleaseId: 'mb-r-1',
          title: 'Test',
          releaseDate: null,
          country: null,
          status: null,
          trackCount: null,
          mediumCount: null,
          barcode: null,
          disambiguation: null,
        },
      ],
    }),
  };
  const importMusicBrainzReleaseGroup = t.mock.fn(async () => ({}));

  const service = createReleaseGroupTracklistService({
    getPoolFn: async () => pool,
    musicBrainzCatalogService,
    importMusicBrainzReleaseGroup,
  });

  await service.getReleaseGroupTracklist({ releaseGroupMbid: 'mb-rg-1', sessionUserId: null });

  // Allow the fire-and-forget to settle
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(importMusicBrainzReleaseGroup.mock.callCount(), 1);
  assert.equal(importMusicBrainzReleaseGroup.mock.calls[0].arguments[0].releaseGroupId, 'mb-rg-1');
});

test('getReleaseGroupTracklist returns requestState from media_requests for session user', async () => {
  const releaseGroup = { id: 'rg-1' };
  const releaseRow = makeReleaseRow();
  const requestStateRow = { id: 'req-1', request_state: 'searching', created_at: '2026-01-01T00:00:00Z' };
  const pool = makePool({ releaseGroup, releases: [releaseRow], media: [], tracks: [], requestState: requestStateRow });

  const service = createReleaseGroupTracklistService({ getPoolFn: async () => pool, musicBrainzCatalogService: noMbCatalogService });
  const result = await service.getReleaseGroupTracklist({ releaseGroupMbid: 'mb-rg-1', sessionUserId: 'user-5' });

  assert.deepEqual(result.requestState, {
    status: 'searching',
    requestId: 'req-1',
    requestedAt: '2026-01-01T00:00:00Z',
  });
});
