import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMetadataReleaseMaterializationService,
  selectMaterializationReleaseCandidate,
} from '../../src/server/metadata/metadata-release-materialization-service.js';

test('selectMaterializationReleaseCandidate prefers official earliest release with country tie-break', () => {
  const result = selectMaterializationReleaseCandidate([
    {
      musicbrainzReleaseId: 'mb-rel-promo',
      releaseDate: '2001-01-01',
      status: 'Promotion',
      title: 'Promo',
      country: 'US',
    },
    {
      musicbrainzReleaseId: 'mb-rel-us',
      releaseDate: '2002-01-01',
      status: 'Official',
      title: 'US',
      country: 'US',
    },
    {
      musicbrainzReleaseId: 'mb-rel-gb',
      releaseDate: '2002-01-01',
      status: 'Official',
      title: 'GB',
      country: 'GB',
    },
  ]);

  assert.equal(result.musicbrainzReleaseId, 'mb-rel-gb');
});

test('materializeMonitoredReleaseGroups imports one candidate for monitored release groups without releases', async (t) => {
  const getReleaseGroupReleases = t.mock.fn(async ({ releaseGroupId }) => ({
    releaseGroupId,
    results: [
      {
        musicbrainzReleaseId: 'mb-rel-1',
        releaseDate: '2018-09-07',
        status: 'Official',
        title: 'Look Up Child',
        country: 'XW',
      },
    ],
  }));
  const importMusicBrainzRelease = t.mock.fn(async ({ releaseId }) => ({
    release: { id: `local-${releaseId}` },
    releaseGroup: { id: 'local-rg-1' },
  }));
  const markCanonicalReleaseFn = t.mock.fn(async () => {});

  const service = createMetadataReleaseMaterializationService({
    getMetadataArtist: t.mock.fn(async () => ({
      releaseGroups: [
        {
          id: 'local-rg-1',
          firstReleaseDate: '2018-09-07',
          primaryType: 'Album',
          source: { musicbrainzReleaseGroupId: 'mb-rg-1' },
          title: 'Look Up Child',
        },
        {
          id: 'local-rg-single',
          firstReleaseDate: '2020-01-01',
          primaryType: 'Single',
          source: { musicbrainzReleaseGroupId: 'mb-rg-single' },
          title: 'Single',
        },
      ],
      releases: [],
    })),
    importMusicBrainzRelease,
    markCanonicalReleaseFn,
    musicBrainzCatalogService: { getReleaseGroupReleases },
  });

  const result = await service.materializeMonitoredReleaseGroups({
    metadataArtistId: 'artist-1',
    monitoringRows: [{
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album', 'ep'],
    }],
  });

  assert.deepEqual(getReleaseGroupReleases.mock.calls[0].arguments[0], {
    releaseGroupId: 'mb-rg-1',
    limit: 25,
    offset: 0,
  });
  assert.deepEqual(importMusicBrainzRelease.mock.calls[0].arguments[0], {
    actorUserId: null,
    releaseId: 'mb-rel-1',
    requestMetadata: null,
  });
  assert.deepEqual(markCanonicalReleaseFn.mock.calls[0].arguments, ['local-rg-1']);
  assert.deepEqual(result, {
    eligibleReleaseGroupCount: 1,
    importedReleaseCount: 1,
    skippedExistingCanonicalCount: 0,
    skippedExistingReleaseCount: 0,
    skippedNoCandidateCount: 0,
  });
});

test('materializeMonitoredReleaseGroups marks existing non-canonical releases without provider import', async (t) => {
  const getReleaseGroupReleases = t.mock.fn(async () => {
    throw new Error('unexpected provider call');
  });
  const importMusicBrainzRelease = t.mock.fn(async () => {
    throw new Error('unexpected import');
  });
  const markCanonicalReleaseFn = t.mock.fn(async () => {});

  const service = createMetadataReleaseMaterializationService({
    getMetadataArtist: t.mock.fn(async () => ({
      releaseGroups: [{
        id: 'local-rg-1',
        firstReleaseDate: '1995-11-06',
        primaryType: 'Album',
        source: { musicbrainzReleaseGroupId: 'mb-rg-1' },
        title: 'Tri Repetae',
      }],
      releases: [{
        id: 'local-rel-1',
        isCanonical: false,
        releaseGroupId: 'local-rg-1',
      }],
    })),
    importMusicBrainzRelease,
    markCanonicalReleaseFn,
    musicBrainzCatalogService: { getReleaseGroupReleases },
  });

  const result = await service.materializeMonitoredReleaseGroups({
    metadataArtistId: 'artist-1',
    monitoringRows: [{
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album'],
    }],
  });

  assert.equal(getReleaseGroupReleases.mock.callCount(), 0);
  assert.equal(importMusicBrainzRelease.mock.callCount(), 0);
  assert.deepEqual(markCanonicalReleaseFn.mock.calls[0].arguments, ['local-rg-1']);
  assert.deepEqual(result, {
    eligibleReleaseGroupCount: 1,
    importedReleaseCount: 0,
    skippedExistingCanonicalCount: 0,
    skippedExistingReleaseCount: 1,
    skippedNoCandidateCount: 0,
  });
});
