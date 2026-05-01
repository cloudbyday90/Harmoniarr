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

import { createMetadataMonitoringService } from './metadata-monitoring-service.js';
import { createMetadataMonitoringStore } from './metadata-monitoring-store.js';
import { createMetadataReadService } from './metadata-read-service.js';
import { createMetadataSearchService } from './metadata-search-service.js';
import { createMusicBrainzCatalogService } from './musicbrainz-catalog-service.js';
import { createMusicBrainzImportService } from './musicbrainz-import-service.js';
import { createMusicBrainzSearchService } from './musicbrainz-search-service.js';

export function createMetadataModule({
  metadataMonitoringStore = createMetadataMonitoringStore(),
  metadataMonitoringService = createMetadataMonitoringService({ metadataMonitoringStore }),
  metadataReadService = createMetadataReadService({ metadataMonitoringStore }),
  metadataSearchService = createMetadataSearchService(),
  providerHealthRecorder = null,
  musicBrainzCatalogService = createMusicBrainzCatalogService({ providerHealthRecorder }),
  musicBrainzImportService = createMusicBrainzImportService({ providerHealthRecorder }),
  musicBrainzSearchService = createMusicBrainzSearchService({ providerHealthRecorder }),
} = {}) {
  return {
    metadataReadService,
    metadataMonitoringService,
    metadataMonitoringStore,
    metadataSearchService,
    providerHealthRecorder,
    musicBrainzCatalogService,
    musicBrainzImportService,
    musicBrainzSearchService,
    routeDependencies: {
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
    },
  };
}
