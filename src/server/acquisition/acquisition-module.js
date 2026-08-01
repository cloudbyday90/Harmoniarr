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

import { createAcquisitionPipelineService } from './acquisition-pipeline-service.js';
import { createAcquisitionPipelineStatusService } from './acquisition-pipeline-status-service.js';
import { createAcquisitionPipelineStore } from './acquisition-pipeline-store.js';
import { createAcquisitionQualityPolicyService } from './acquisition-quality-policy-service.js';

export function createAcquisitionModule({
  allowMusicQueueFallbackQuality = null,
  buildLibraryWantedReleases,
  createPipelineService = createAcquisitionPipelineService,
  createPipelineStatusService = createAcquisitionPipelineStatusService,
  createPipelineStore = createAcquisitionPipelineStore,
  createQualityPolicyService = createAcquisitionQualityPolicyService,
  recheckReleaseSafeAdd = null,
  rejectImportCandidate = null,
  recordActivityEventFn = null,
  requestMusicQueueRediscovery = null,
  selectImportCandidate = null,
  startReleaseManualSafeAdd = null,
  startLibraryDiscoveryRun = null,
} = {}) {
  const qualityPolicyService = createQualityPolicyService();
  const statusService = createPipelineStatusService();
  const acquisitionPipelineStore = createPipelineStore({ buildLibraryWantedReleases });
  const acquisitionPipelineService = createPipelineService({
    acquisitionPipelineStore,
    allowMusicQueueFallbackQuality,
    qualityPolicyService,
    recheckReleaseSafeAdd,
    rejectImportCandidate,
    recordActivityEventFn,
    requestMusicQueueRediscovery,
    selectImportCandidate,
    startReleaseManualSafeAdd,
    startLibraryDiscoveryRun,
    statusService,
  });

  return {
    acquisitionPipelineService,
    acquisitionPipelineStore,
    qualityPolicyService,
    routeDependencies: {
      addMusicQueueReleaseToLibrary: acquisitionPipelineService.addMusicQueueReleaseToLibrary,
      getMusicQueueRelease: acquisitionPipelineService.getMusicQueueRelease,
      allowMusicQueueReleaseFallbackQuality: acquisitionPipelineService.allowMusicQueueReleaseFallbackQuality,
      listMusicQueueReleases: acquisitionPipelineService.listMusicQueueReleases,
      recheckMusicQueueReleaseSafeAdd: acquisitionPipelineService.recheckMusicQueueReleaseSafeAdd,
      requestMusicQueueReleaseRediscovery: acquisitionPipelineService.requestMusicQueueReleaseRediscovery,
      rejectMusicQueueMatch: acquisitionPipelineService.rejectMusicQueueMatch,
      useMusicQueueMatch: acquisitionPipelineService.useMusicQueueMatch,
    },
    statusService,
  };
}
