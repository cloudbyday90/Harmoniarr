import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataRefreshService } from '../../src/server/metadata/metadata-refresh-service.js';

test('refreshArtistCatalogById stores the artist catalog and triggers wanted reconciliation', async (t) => {
  const lookupArtist = t.mock.fn(async () => ({
    id: 'mb-artist-1',
    name: 'Autechre',
    'sort-name': 'Autechre',
    aliases: [{ name: 'AE', locale: 'en', primary: false }],
  }));
  const browseArtistReleaseGroups = t.mock.fn(async () => ({
    'release-group-count': 2,
    'release-groups': [
      {
        id: 'mb-rg-1',
        title: 'Tri Repetae',
        'artist-credit': [{ artist: { id: 'mb-artist-1', name: 'Autechre' }, name: 'Autechre' }],
        'primary-type': 'Album',
        'secondary-types': [],
        'first-release-date': '1995-11-06',
      },
      {
        id: 'mb-rg-2',
        title: 'Chiastic Slide',
        'artist-credit': [{ artist: { id: 'mb-artist-1', name: 'Autechre' }, name: 'Autechre' }],
        'primary-type': 'Album',
        'secondary-types': [],
        'first-release-date': '1997-02-10',
      },
    ],
  }));
  const storeArtist = t.mock.fn(async ({ artist }) => ({ id: 'local-artist-1', name: artist.name }));
  const storeReleaseGroup = t.mock.fn(async ({ releaseGroup }) => ({
    artist: { id: 'local-artist-1' },
    releaseGroup: { id: releaseGroup.musicbrainzReleaseGroupId, title: releaseGroup.title },
  }));
  const reconcileWantedReleases = t.mock.fn(async () => {});

  const service = createMetadataRefreshService({
    metadataService: {
      storeArtist,
      storeReleaseGroup,
    },
    musicBrainzClient: {
      browseArtistReleaseGroups,
      lookupArtist,
    },
    nowFn: () => new Date('2026-05-02T12:00:00.000Z'),
    reconcileWantedReleases,
  });

  const result = await service.refreshArtistCatalogById({ musicBrainzArtistId: 'mb-artist-1' });

  assert.equal(lookupArtist.mock.callCount(), 1);
  assert.deepEqual(lookupArtist.mock.calls[0].arguments[0], {
    artistId: 'mb-artist-1',
    includeAliases: true,
  });
  assert.equal(browseArtistReleaseGroups.mock.callCount(), 1);
  assert.deepEqual(browseArtistReleaseGroups.mock.calls[0].arguments[0], {
    artistId: 'mb-artist-1',
    limit: 100,
    offset: 0,
    releaseGroupStatus: 'website-default',
  });
  assert.equal(storeArtist.mock.callCount(), 1);
  assert.equal(storeReleaseGroup.mock.callCount(), 2);
  assert.equal(reconcileWantedReleases.mock.callCount(), 1);
  assert.equal(result.releaseGroupCount, 2);
  assert.equal(result.refreshedAt, '2026-05-02T12:00:00.000Z');
  assert.equal(result.wantedReconciliationCompleted, true);
});

test('refreshArtistCatalogById records detection history for newly discovered release groups on known artists', async (t) => {
  const lookupArtist = t.mock.fn(async () => ({
    id: 'mb-artist-1',
    name: 'Autechre',
    'sort-name': 'Autechre',
    aliases: [],
  }));
  const browseArtistReleaseGroups = t.mock.fn(async () => ({
    'release-group-count': 2,
    'release-groups': [
      {
        id: 'mb-rg-1',
        title: 'Tri Repetae',
        'artist-credit': [{ artist: { id: 'mb-artist-1', name: 'Autechre' }, name: 'Autechre' }],
        'primary-type': 'Album',
        'secondary-types': [],
        'first-release-date': '1995-11-06',
      },
      {
        id: 'mb-rg-2',
        title: 'Sign',
        'artist-credit': [{ artist: { id: 'mb-artist-1', name: 'Autechre' }, name: 'Autechre' }],
        'primary-type': 'Album',
        'secondary-types': [],
        'first-release-date': '2020-10-16',
      },
    ],
  }));
  const recordDetectedReleaseGroups = t.mock.fn(async () => [{ id: 'event-1' }]);

  const service = createMetadataRefreshService({
    getMetadataArtistByMusicBrainzId: t.mock.fn(async () => ({
      artist: { id: 'local-artist-1', name: 'Autechre' },
      aliases: [],
      detectionEvents: [],
      monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album'] },
      releaseGroups: [{
        id: 'local-rg-1',
        source: { musicbrainzReleaseGroupId: 'mb-rg-1' },
        title: 'Tri Repetae',
      }],
      releases: [],
    })),
    metadataReleaseDetectionService: {
      recordDetectedReleaseGroups,
    },
    metadataService: {
      storeArtist: t.mock.fn(async ({ artist }) => ({ id: 'local-artist-1', name: artist.name })),
      storeReleaseGroup: t.mock.fn(async ({ releaseGroup }) => ({
        artist: { id: 'local-artist-1' },
        releaseGroup: {
          firstReleaseDate: releaseGroup.firstReleaseDate,
          id: releaseGroup.id ?? `local-${releaseGroup.musicbrainzReleaseGroupId}`,
          primaryType: releaseGroup.primaryType,
          source: {
            musicbrainzReleaseGroupId: releaseGroup.musicbrainzReleaseGroupId,
          },
          title: releaseGroup.title,
        },
      })),
    },
    musicBrainzClient: {
      browseArtistReleaseGroups,
      lookupArtist,
    },
    nowFn: () => new Date('2026-05-02T12:00:00.000Z'),
    reconcileWantedReleases: t.mock.fn(async () => {}),
  });

  const result = await service.refreshArtistCatalogById({
    metadataArtistId: 'local-artist-1',
    musicBrainzArtistId: 'mb-artist-1',
    runId: 'run-1',
    triggerSource: 'scheduled',
  });

  assert.equal(recordDetectedReleaseGroups.mock.callCount(), 1);
  assert.deepEqual(recordDetectedReleaseGroups.mock.calls[0].arguments[0], {
    artistName: 'Autechre',
    metadataArtistId: 'local-artist-1',
    monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album'] },
    operationRunId: 'run-1',
    refreshedAt: '2026-05-02T12:00:00.000Z',
    releaseGroups: [{
      firstReleaseDate: '2020-10-16',
      id: 'local-mb-rg-2',
      primaryType: 'Album',
      source: {
        musicbrainzReleaseGroupId: 'mb-rg-2',
      },
      title: 'Sign',
    }],
    triggerSource: 'scheduled',
  });
  assert.equal(result.detectedReleaseGroupCount, 1);
});

test('refreshArtistCatalogById prefers operator-derived monitoring for detection decisions', async (t) => {
  const recordDetectedReleaseGroups = t.mock.fn(async () => [{ id: 'event-1' }]);
  const getArtistRefreshMonitoring = t.mock.fn(async () => ({
    isMonitored: true,
    monitoredReleaseGroupTypes: ['album', 'single'],
  }));

  const service = createMetadataRefreshService({
    getArtistRefreshMonitoring,
    getMetadataArtistByMusicBrainzId: t.mock.fn(async () => ({
      artist: { id: 'local-artist-1', name: 'Autechre' },
      monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['ep'] },
      releaseGroups: [{
        id: 'local-rg-1',
        source: { musicbrainzReleaseGroupId: 'mb-rg-1' },
      }],
    })),
    metadataReleaseDetectionService: {
      recordDetectedReleaseGroups,
    },
    metadataService: {
      storeArtist: t.mock.fn(async ({ artist }) => ({ id: 'local-artist-1', name: artist.name })),
      storeReleaseGroup: t.mock.fn(async ({ releaseGroup }) => ({
        artist: { id: 'local-artist-1' },
        releaseGroup: {
          id: `local-${releaseGroup.musicbrainzReleaseGroupId}`,
          primaryType: releaseGroup.primaryType,
          source: { musicbrainzReleaseGroupId: releaseGroup.musicbrainzReleaseGroupId },
          title: releaseGroup.title,
        },
      })),
    },
    musicBrainzClient: {
      browseArtistReleaseGroups: t.mock.fn(async () => ({
        'release-group-count': 2,
        'release-groups': [
          {
            id: 'mb-rg-1',
            title: 'Tri Repetae',
            'artist-credit': [{ artist: { id: 'mb-artist-1', name: 'Autechre' }, name: 'Autechre' }],
            'primary-type': 'Album',
          },
          {
            id: 'mb-rg-2',
            title: 'New Single',
            'artist-credit': [{ artist: { id: 'mb-artist-1', name: 'Autechre' }, name: 'Autechre' }],
            'primary-type': 'Single',
          },
        ],
      })),
      lookupArtist: t.mock.fn(async () => ({
        aliases: [],
        id: 'mb-artist-1',
        name: 'Autechre',
      })),
    },
    nowFn: () => new Date('2026-06-15T12:00:00.000Z'),
  });

  await service.refreshArtistCatalogById({
    metadataArtistId: 'local-artist-1',
    musicBrainzArtistId: 'mb-artist-1',
  });

  assert.deepEqual(getArtistRefreshMonitoring.mock.calls[0].arguments[0], 'local-artist-1');
  assert.deepEqual(recordDetectedReleaseGroups.mock.calls[0].arguments[0].monitoring, {
    isMonitored: true,
    monitoredReleaseGroupTypes: ['album', 'single'],
  });
});

test('refreshArtistCatalogById queues operator reconciliation after storing refreshed release groups', async (t) => {
  const listOperatorArtistMonitoringByMetadataArtist = t.mock.fn(async () => [
    {
      appUserId: 'user-1',
      isMonitored: true,
      metadataArtistId: 'local-artist-1',
    },
    {
      appUserId: 'user-2',
      isMonitored: true,
      metadataArtistId: 'local-artist-1',
    },
  ]);
  const queueOperatorArtistReconciliation = t.mock.fn(async ({ appUserId }) => {
    if (appUserId === 'user-2') {
      const error = new Error('No saved artist reconciliation snapshot is available yet');
      error.code = 'operator_artist_reconciliation_not_ready';
      throw error;
    }
    return { accepted: true };
  });
  const storeReleaseGroup = t.mock.fn(async ({ releaseGroup }) => ({
    artist: { id: 'local-artist-1' },
    releaseGroup: {
      id: `local-${releaseGroup.musicbrainzReleaseGroupId}`,
      primaryType: releaseGroup.primaryType,
      source: { musicbrainzReleaseGroupId: releaseGroup.musicbrainzReleaseGroupId },
      title: releaseGroup.title,
    },
  }));
  const materializeMonitoredReleaseGroups = t.mock.fn(async () => ({
    eligibleReleaseGroupCount: 1,
    importedReleaseCount: 1,
    skippedExistingCanonicalCount: 0,
    skippedExistingReleaseCount: 0,
    skippedNoCandidateCount: 0,
  }));

  const service = createMetadataRefreshService({
    getMetadataArtistByMusicBrainzId: t.mock.fn(async () => ({
      artist: { id: 'local-artist-1', name: 'Lauren Daigle' },
      releaseGroups: [],
      releases: [],
    })),
    listOperatorArtistMonitoringByMetadataArtist,
    materializeMonitoredReleaseGroups,
    metadataReleaseDetectionService: {
      recordDetectedReleaseGroups: t.mock.fn(async () => []),
    },
    metadataService: {
      storeArtist: t.mock.fn(async ({ artist }) => ({ id: 'local-artist-1', name: artist.name })),
      storeReleaseGroup,
    },
    musicBrainzClient: {
      browseArtistReleaseGroups: t.mock.fn(async () => ({
        'release-group-count': 1,
        'release-groups': [{
          id: 'mb-rg-1',
          title: 'Look Up Child',
          'artist-credit': [{ artist: { id: 'mb-artist-1', name: 'Lauren Daigle' }, name: 'Lauren Daigle' }],
          'primary-type': 'Album',
          'first-release-date': '2018-09-07',
        }],
      })),
      lookupArtist: t.mock.fn(async () => ({
        aliases: [],
        id: 'mb-artist-1',
        name: 'Lauren Daigle',
      })),
    },
    nowFn: () => new Date('2026-06-27T20:26:37.000Z'),
    queueOperatorArtistReconciliation,
  });

  const result = await service.refreshArtistCatalogById({
    metadataArtistId: 'local-artist-1',
    musicBrainzArtistId: 'mb-artist-1',
    triggerSource: 'monitor_added',
  });

  assert.equal(storeReleaseGroup.mock.callCount(), 1);
  assert.deepEqual(listOperatorArtistMonitoringByMetadataArtist.mock.calls[0].arguments[0], {
    metadataArtistId: 'local-artist-1',
  });
  assert.deepEqual(materializeMonitoredReleaseGroups.mock.calls[0].arguments[0], {
    metadataArtistId: 'local-artist-1',
    monitoringRows: [
      {
        appUserId: 'user-1',
        isMonitored: true,
        metadataArtistId: 'local-artist-1',
      },
      {
        appUserId: 'user-2',
        isMonitored: true,
        metadataArtistId: 'local-artist-1',
      },
    ],
    throwIfCancelled: materializeMonitoredReleaseGroups.mock.calls[0].arguments[0].throwIfCancelled,
  });
  assert.equal(queueOperatorArtistReconciliation.mock.callCount(), 2);
  assert.deepEqual(queueOperatorArtistReconciliation.mock.calls[0].arguments[0], {
    appUserId: 'user-1',
    metadataArtistId: 'local-artist-1',
    triggerSource: 'metadata_refresh:monitor_added',
  });
  assert.deepEqual(queueOperatorArtistReconciliation.mock.calls[1].arguments[0], {
    appUserId: 'user-2',
    metadataArtistId: 'local-artist-1',
    triggerSource: 'metadata_refresh:monitor_added',
  });
  assert.equal(result.materializedEligibleReleaseGroupCount, 1);
  assert.equal(result.materializedImportedReleaseCount, 1);
  assert.equal(result.materializedSkippedExistingCanonicalCount, 0);
  assert.equal(result.materializedSkippedExistingReleaseCount, 0);
  assert.equal(result.materializedSkippedNoCandidateCount, 0);
  assert.equal(result.operatorReconciliationQueuedCount, 1);
  assert.equal(result.operatorReconciliationSkippedNotReadyCount, 1);
});
