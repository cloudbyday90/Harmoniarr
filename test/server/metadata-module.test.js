import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataModule } from '../../src/server/metadata/metadata-module.js';
import { forceCanonicalRelease } from '../../src/server/metadata/canonical-release-service.js';

test('createMetadataModule exposes shared route dependencies from injected services', () => {
  const metadataArtistRefreshRunStore = {};
  const metadataArtistRefreshService = {
    startMetadataArtistRefresh: () => {},
  };
  const metadataArtistRefreshWorker = {};
  const metadataRefreshDispatchPolicyService = {
    resolveDispatchReadiness: () => ({ allowed: true }),
  };
  const metadataArtistRefreshStateStore = {};
  const metadataProviderCacheService = {};
  const metadataProviderCacheObservabilityService = {
    getSummary: () => {},
  };
  const metadataProviderResponseCacheStore = {};
  const operatorArtistProjectionService = {
    getOperatorArtistProjection: () => {},
  };
  const operatorMonitoredArtistProjectionService = {
    listOperatorMonitoredArtistProjections: () => {},
  };
  const operatorArtistSaveService = {
    saveOperatorArtist: () => {},
  };
  const operatorArtistReconciliationService = {
    queueOperatorArtistReconciliation: async () => {},
  };
  const metadataReadService = {
    getArtist: () => {},
    getArtistByMusicBrainzId: () => {},
    getArtistDetectionEvents: () => {},
    getRelease: () => {},
    getReleaseByMusicBrainzId: () => {},
    getReleaseGroup: () => {},
    getReleaseGroupByMusicBrainzId: () => {},
  };
  const metadataSearchService = {
    searchAll: () => {},
    searchArtists: () => {},
    searchReleaseGroups: () => {},
    searchReleases: () => {},
  };
  const musicBrainzCatalogService = {
    browseArtistReleaseGroups: () => {},
    getReleaseGroupReleases: () => {},
  };
  const musicBrainzImportService = {
    importArtistById: () => {},
    importReleaseGroupById: () => {},
    importReleaseById: () => {},
  };
  const musicBrainzSearchService = {
    searchArtists: () => {},
    searchReleases: () => {},
  };
  const similarArtistsService = {
    getSimilarArtists: () => {},
  };
  const releaseGroupTracklistService = {
    getReleaseGroupTracklist: () => {},
  };
  const metadataRefreshService = {
    refreshArtistCatalogById: () => {},
  };
  const metadataReleaseMaterializationService = {
    materializeMonitoredReleaseGroups: () => {},
  };
  const providerHealthRecorder = {
    recordError: () => {},
    recordSuccess: () => {},
  };

  const metadataModule = createMetadataModule({
    metadataArtistRefreshRunStore,
    metadataArtistRefreshService,
    metadataArtistRefreshWorker,
    metadataRefreshDispatchPolicyService,
    metadataArtistRefreshStateStore,
    metadataProviderCacheService,
    metadataProviderCacheObservabilityService,
    metadataProviderResponseCacheStore,
    operatorArtistProjectionService,
    operatorMonitoredArtistProjectionService,
    operatorArtistSaveService,
    operatorArtistReconciliationService,
    metadataReadService,
    metadataRefreshService,
    metadataReleaseMaterializationService,
    metadataSearchService,
    providerHealthRecorder,
    musicBrainzCatalogService,
    musicBrainzImportService,
    musicBrainzSearchService,
    similarArtistsService,
    releaseGroupTracklistService,
  });

  assert.equal(metadataModule.metadataArtistRefreshRunStore, metadataArtistRefreshRunStore);
  assert.equal(metadataModule.metadataArtistRefreshService, metadataArtistRefreshService);
  assert.equal(metadataModule.metadataArtistRefreshWorker, metadataArtistRefreshWorker);
  assert.equal(metadataModule.metadataRefreshDispatchPolicyService, metadataRefreshDispatchPolicyService);
  assert.equal(metadataModule.metadataReadService, metadataReadService);
  assert.equal(metadataModule.metadataArtistRefreshStateStore, metadataArtistRefreshStateStore);
  assert.equal(metadataModule.metadataProviderCacheService, metadataProviderCacheService);
  assert.equal(metadataModule.metadataProviderCacheObservabilityService, metadataProviderCacheObservabilityService);
  assert.equal(metadataModule.metadataProviderResponseCacheStore, metadataProviderResponseCacheStore);
  assert.equal(metadataModule.operatorMonitoredArtistProjectionService, operatorMonitoredArtistProjectionService);
  assert.equal(metadataModule.operatorArtistProjectionService, operatorArtistProjectionService);
  assert.equal(metadataModule.operatorArtistSaveService, operatorArtistSaveService);
  assert.equal(metadataModule.metadataRefreshService, metadataRefreshService);
  assert.equal(metadataModule.metadataReleaseMaterializationService, metadataReleaseMaterializationService);
  assert.equal(metadataModule.metadataSearchService, metadataSearchService);
  assert.equal(metadataModule.providerHealthRecorder, providerHealthRecorder);
  assert.equal(metadataModule.musicBrainzCatalogService, musicBrainzCatalogService);
  assert.equal(metadataModule.musicBrainzImportService, musicBrainzImportService);
  assert.equal(metadataModule.musicBrainzSearchService, musicBrainzSearchService);
  assert.equal(metadataModule.similarArtistsService, similarArtistsService);
  assert.deepEqual(metadataModule.routeDependencies, {
    browseMusicBrainzArtistReleaseGroups: musicBrainzCatalogService.browseArtistReleaseGroups,
    getMusicBrainzReleaseGroupReleases: musicBrainzCatalogService.getReleaseGroupReleases,
    getMetadataArtist: metadataReadService.getArtist,
    getMetadataArtistByMusicBrainzId: metadataReadService.getArtistByMusicBrainzId,
    getMetadataArtistDetectionEvents: metadataReadService.getArtistDetectionEvents,
    getMetadataProviderCacheObservability: metadataProviderCacheObservabilityService.getSummary,
    listOperatorMonitoredArtistProjections: operatorMonitoredArtistProjectionService.listOperatorMonitoredArtistProjections,
    getOperatorArtistProjection: operatorArtistProjectionService.getOperatorArtistProjection,
    getMetadataRelease: metadataReadService.getRelease,
    getMetadataReleaseByMusicBrainzId: metadataReadService.getReleaseByMusicBrainzId,
    getMetadataReleaseGroup: metadataReadService.getReleaseGroup,
    getMetadataReleaseGroupByMusicBrainzId: metadataReadService.getReleaseGroupByMusicBrainzId,
    saveOperatorArtist: operatorArtistSaveService.saveOperatorArtist,
    startMetadataArtistRefresh: metadataArtistRefreshService.startMetadataArtistRefresh,
    importMusicBrainzArtist: musicBrainzImportService.importArtistById,
    importMusicBrainzReleaseGroup: musicBrainzImportService.importReleaseGroupById,
    importMusicBrainzRelease: musicBrainzImportService.importReleaseById,
    searchLocalMetadataArtists: metadataSearchService.searchArtists,
    searchAllLocalMetadata: metadataSearchService.searchAll,
    searchLocalMetadataReleaseGroups: metadataSearchService.searchReleaseGroups,
    searchLocalMetadataReleases: metadataSearchService.searchReleases,
    listAllMonitoredArtists: metadataSearchService.listAllMonitoredArtists,
    searchMusicBrainzArtists: musicBrainzSearchService.searchArtists,
    searchMusicBrainzReleases: musicBrainzSearchService.searchReleases,
    getSimilarArtists: similarArtistsService.getSimilarArtists,
    getReleaseGroupTracklist: releaseGroupTracklistService.getReleaseGroupTracklist,
    markCanonicalRelease: forceCanonicalRelease,
    queueOperatorArtistReconciliation: operatorArtistReconciliationService.queueOperatorArtistReconciliation,
  });
});

test('createMetadataModule shares an injected MusicBrainz client with default catalog and search services', async () => {
  const calls = [];
  const musicBrainzClient = {
    async browseArtistReleaseGroups(input) {
      calls.push({ method: 'browseArtistReleaseGroups', input });
      return {
        'release-groups': [],
      };
    },
    async searchArtists(input) {
      calls.push({ method: 'searchArtists', input });
      return {
        artists: [],
        count: 0,
        offset: 0,
      };
    },
  };
  const metadataProviderCacheService = {
    async getOrLoad({ load }) {
      return {
        cache: { state: 'cold' },
        payload: await load(),
      };
    },
  };

  const metadataModule = createMetadataModule({
    metadataProviderCacheService,
    musicBrainzClient,
  });

  await metadataModule.routeDependencies.browseMusicBrainzArtistReleaseGroups({
    artistId: 'artist-1',
    limit: 25,
    offset: 0,
  });
  await metadataModule.routeDependencies.searchMusicBrainzArtists({
    query: 'example artist',
    limit: 10,
  });

  assert.deepEqual(calls, [
    {
      method: 'browseArtistReleaseGroups',
      input: {
        artistId: 'artist-1',
        limit: 25,
        offset: 0,
        releaseGroupStatus: 'website-default',
        type: null,
      },
    },
    {
      method: 'searchArtists',
      input: {
        query: 'example artist',
        limit: 10,
        dismax: true,
      },
    },
  ]);
});
