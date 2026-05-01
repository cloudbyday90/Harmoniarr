import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataModule } from '../../src/server/metadata/metadata-module.js';

test('createMetadataModule exposes shared route dependencies from injected services', () => {
  const metadataMonitoringService = {
    updateArtistMonitoring: () => {},
  };
  const metadataMonitoringStore = {};
  const metadataReadService = {
    getArtist: () => {},
    getArtistByMusicBrainzId: () => {},
    getRelease: () => {},
    getReleaseByMusicBrainzId: () => {},
    getReleaseGroup: () => {},
    getReleaseGroupByMusicBrainzId: () => {},
  };
  const metadataSearchService = {
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
  const providerHealthRecorder = {
    recordError: () => {},
    recordSuccess: () => {},
  };

  const metadataModule = createMetadataModule({
    metadataMonitoringService,
    metadataMonitoringStore,
    metadataReadService,
    metadataSearchService,
    providerHealthRecorder,
    musicBrainzCatalogService,
    musicBrainzImportService,
    musicBrainzSearchService,
  });

  assert.equal(metadataModule.metadataReadService, metadataReadService);
  assert.equal(metadataModule.metadataMonitoringService, metadataMonitoringService);
  assert.equal(metadataModule.metadataMonitoringStore, metadataMonitoringStore);
  assert.equal(metadataModule.metadataSearchService, metadataSearchService);
  assert.equal(metadataModule.providerHealthRecorder, providerHealthRecorder);
  assert.equal(metadataModule.musicBrainzCatalogService, musicBrainzCatalogService);
  assert.equal(metadataModule.musicBrainzImportService, musicBrainzImportService);
  assert.equal(metadataModule.musicBrainzSearchService, musicBrainzSearchService);
  assert.deepEqual(metadataModule.routeDependencies, {
    browseMusicBrainzArtistReleaseGroups: musicBrainzCatalogService.browseArtistReleaseGroups,
    getMusicBrainzReleaseGroupReleases: musicBrainzCatalogService.getReleaseGroupReleases,
    getMetadataArtist: metadataReadService.getArtist,
    getMetadataArtistByMusicBrainzId: metadataReadService.getArtistByMusicBrainzId,
    getMetadataRelease: metadataReadService.getRelease,
    getMetadataReleaseByMusicBrainzId: metadataReadService.getReleaseByMusicBrainzId,
    getMetadataReleaseGroup: metadataReadService.getReleaseGroup,
    getMetadataReleaseGroupByMusicBrainzId: metadataReadService.getReleaseGroupByMusicBrainzId,
    updateMetadataArtistMonitoring: metadataMonitoringService.updateArtistMonitoring,
    importMusicBrainzArtist: musicBrainzImportService.importArtistById,
    importMusicBrainzReleaseGroup: musicBrainzImportService.importReleaseGroupById,
    importMusicBrainzRelease: musicBrainzImportService.importReleaseById,
    searchLocalMetadataArtists: metadataSearchService.searchArtists,
    searchLocalMetadataReleaseGroups: metadataSearchService.searchReleaseGroups,
    searchLocalMetadataReleases: metadataSearchService.searchReleases,
    searchMusicBrainzArtists: musicBrainzSearchService.searchArtists,
    searchMusicBrainzReleases: musicBrainzSearchService.searchReleases,
  });
});
