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
  const operatorArtistProjectionService = {
    getOperatorArtistProjection: () => {},
  };
  const operatorMonitoredArtistProjectionService = {
    listOperatorMonitoredArtistProjections: () => {},
  };
  const operatorArtistSaveService = {
    saveOperatorArtist: () => {},
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
    operatorArtistProjectionService,
    operatorMonitoredArtistProjectionService,
    operatorArtistSaveService,
    metadataReadService,
    metadataRefreshService,
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
  assert.equal(metadataModule.operatorMonitoredArtistProjectionService, operatorMonitoredArtistProjectionService);
  assert.equal(metadataModule.operatorArtistProjectionService, operatorArtistProjectionService);
  assert.equal(metadataModule.operatorArtistSaveService, operatorArtistSaveService);
  assert.equal(metadataModule.metadataRefreshService, metadataRefreshService);
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
  });
});
