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

import { createMissingMusicDecisionService } from './missing-music-decision-service.js';
import { createMissingMusicDecisionCommandService } from './missing-music-decision-command-service.js';
import { createMissingMusicDownloadStartService } from './missing-music-download-start-service.js';
import { createMissingMusicDecisionTargetService } from './missing-music-decision-target-service.js';
import { createMissingMusicDownloaderHandoffService } from './missing-music-downloader-handoff-service.js';
import { createMissingMusicSearchAgainService } from './missing-music-search-again-service.js';
import { createMissingMusicFallbackQualityService } from './missing-music-fallback-quality-service.js';
import { createMissingMusicFindMatchesService } from './missing-music-find-matches-service.js';
import { createMissingMusicLibraryAddRecheckService } from './missing-music-library-add-recheck-service.js';
import { createMissingMusicLibraryAddService } from './missing-music-library-add-service.js';
import { createApiError } from '../auth.js';

export function createMissingMusicModule({
  allowMusicQueueReleaseFallbackQuality,
  executeIdempotentMutation = async ({ executeMutation }) => executeMutation(),
  listAppUsers,
  listWantedReleaseIdentityPage,
  listWantedReleasesWithMetadata,
  recordActivityEventFn = null,
  requestMusicQueueReleaseRediscovery,
  requestInitialMusicSearch,
  recheckReleaseSafeAdd = async () => { throw createApiError(503, 'missing_music_recheck_unavailable', 'Library-add recheck is unavailable'); },
  startReleaseManualSafeAdd = async () => { throw createApiError(503, 'missing_music_library_add_unavailable', 'Library add is unavailable'); },
  startLibraryDiscoveryRun,
  selectImportCandidate,
  startImportCandidateExecutionRun,
} = {}) {
  const missingMusicDecisionTargetService = createMissingMusicDecisionTargetService({
    listAppUsers,
    listWantedReleasesWithMetadata,
  });
  const missingMusicDecisionService = createMissingMusicDecisionService({
    listAppUsers,
    listWantedReleaseIdentityPage,
    listWantedReleasesWithMetadata,
    resolveMissingMusicDecisionTarget: missingMusicDecisionTargetService.resolveMissingMusicDecisionTarget,
  });
  const missingMusicDecisionCommandService = createMissingMusicDecisionCommandService({
    recordActivityEventFn,
    resolveMissingMusicDecisionTarget: missingMusicDecisionTargetService.resolveMissingMusicDecisionTarget,
    selectImportCandidate,
  });
  const missingMusicDownloadStartService = createMissingMusicDownloadStartService({
    recordActivityEventFn,
    resolveMissingMusicDecisionTarget: missingMusicDecisionTargetService.resolveMissingMusicDecisionTarget,
    startImportCandidateExecutionRun,
  });
  const missingMusicDownloaderHandoffService = createMissingMusicDownloaderHandoffService({
    resolveMissingMusicDecisionTarget: missingMusicDecisionTargetService.resolveMissingMusicDecisionTarget,
  });
  const missingMusicSearchAgainService = createMissingMusicSearchAgainService({
    requestMusicQueueReleaseRediscovery,
    resolveMissingMusicDecisionTarget: missingMusicDecisionTargetService.resolveMissingMusicDecisionTarget,
  });
  const missingMusicFallbackQualityService = createMissingMusicFallbackQualityService({
    allowMusicQueueReleaseFallbackQuality,
    resolveMissingMusicDecisionTarget: missingMusicDecisionTargetService.resolveMissingMusicDecisionTarget,
  });
  const missingMusicFindMatchesService = createMissingMusicFindMatchesService({ requestInitialMusicSearch, startLibraryDiscoveryRun,
    resolveMissingMusicDecisionTarget: missingMusicDecisionTargetService.resolveMissingMusicDecisionTarget });
  const missingMusicLibraryAddRecheckService = createMissingMusicLibraryAddRecheckService({ recheckReleaseSafeAdd,
    resolveMissingMusicDecisionTarget: missingMusicDecisionTargetService.resolveMissingMusicDecisionTarget });
  const missingMusicLibraryAddService = createMissingMusicLibraryAddService({ startReleaseManualSafeAdd,
    resolveMissingMusicDecisionTarget: missingMusicDecisionTargetService.resolveMissingMusicDecisionTarget });

  return {
    missingMusicDecisionCommandService,
    missingMusicDecisionService,
    missingMusicDecisionTargetService,
    missingMusicDownloadStartService,
    missingMusicDownloaderHandoffService,
    missingMusicSearchAgainService,
    missingMusicFallbackQualityService,
    missingMusicFindMatchesService,
    missingMusicLibraryAddRecheckService,
    missingMusicLibraryAddService,
    routeDependencies: {
      addMissingMusicDecisionToLibrary: missingMusicLibraryAddService.addMissingMusicDecisionToLibrary,
      findMissingMusicDecisionMatches: missingMusicFindMatchesService.findMissingMusicDecisionMatches,
      recheckMissingMusicDecisionLibraryAdd: missingMusicLibraryAddRecheckService.recheckMissingMusicDecisionLibraryAdd,
      allowMissingMusicDecisionFallbackQuality: missingMusicFallbackQualityService.allowMissingMusicDecisionFallbackQuality,
      executeIdempotentMutation,
      getMissingMusicDecisionDetail: missingMusicDecisionService.getMissingMusicDecisionDetail,
      getMissingMusicDownloaderHandoff: missingMusicDownloaderHandoffService.getMissingMusicDownloaderHandoff,
      listMissingMusicDecisions: missingMusicDecisionService.listMissingMusicDecisions,
      selectMissingMusicDecisionMatch: missingMusicDecisionCommandService.selectMissingMusicDecisionMatch,
      searchMissingMusicDecisionAgain: missingMusicSearchAgainService.searchMissingMusicDecisionAgain,
      startMissingMusicDecisionDownload: missingMusicDownloadStartService.startMissingMusicDecisionDownload,
    },
  };
}
