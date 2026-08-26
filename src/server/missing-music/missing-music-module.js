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

export function createMissingMusicModule({
  listAppUsers,
  listWantedReleasesWithMetadata,
  recordActivityEventFn = null,
  selectImportCandidate,
  startImportCandidateExecutionRun,
} = {}) {
  const missingMusicDecisionTargetService = createMissingMusicDecisionTargetService({
    listAppUsers,
    listWantedReleasesWithMetadata,
  });
  const missingMusicDecisionService = createMissingMusicDecisionService({
    listAppUsers,
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

  return {
    missingMusicDecisionCommandService,
    missingMusicDecisionService,
    missingMusicDecisionTargetService,
    missingMusicDownloadStartService,
    missingMusicDownloaderHandoffService,
    routeDependencies: {
      getMissingMusicDecisionDetail: missingMusicDecisionService.getMissingMusicDecisionDetail,
      getMissingMusicDownloaderHandoff: missingMusicDownloaderHandoffService.getMissingMusicDownloaderHandoff,
      listMissingMusicDecisions: missingMusicDecisionService.listMissingMusicDecisions,
      selectMissingMusicDecisionMatch: missingMusicDecisionCommandService.selectMissingMusicDecisionMatch,
      startMissingMusicDecisionDownload: missingMusicDownloadStartService.startMissingMusicDecisionDownload,
    },
  };
}
