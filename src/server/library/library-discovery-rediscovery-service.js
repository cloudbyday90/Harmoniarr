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

export const DOWNLOAD_RECOVERY_REDISCOVERY_DELAY_MS = 2 * 60 * 60 * 1000;
export const MAX_DOWNLOAD_RECOVERY_RESEARCH_ATTEMPTS = 2;
export const DOWNLOAD_RECOVERY_REDISCOVERY_SEARCH_ATTEMPT_COUNT = 1;

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isFuturePendingRediscovery(discoveryRequest, now) {
  const marker = discoveryRequest?.evidence?.downloadRecoveryRediscovery;
  const nextSearchAfter = discoveryRequest?.nextSearchAfter ?? marker?.nextSearchAfter ?? null;
  if (!nextSearchAfter) {
    return false;
  }

  const deadline = new Date(nextSearchAfter);
  return discoveryRequest?.requestStatus === 'ready'
    && !Number.isNaN(deadline.getTime())
    && deadline.getTime() > now.getTime();
}

function notifyDownloadRecoveryExhausted(onDownloadRecoveryExhaustedFn, payload) {
  if (typeof onDownloadRecoveryExhaustedFn !== 'function') {
    return;
  }

  void onDownloadRecoveryExhaustedFn(payload).catch(() => {});
}

export function createLibraryDiscoveryRediscoveryService({
  createDiscoveryRun = async () => null,
  getNow = () => new Date(),
  libraryDiscoveryRequestStore,
  maxResearchAttemptCount = MAX_DOWNLOAD_RECOVERY_RESEARCH_ATTEMPTS,
  onDownloadRecoveryExhaustedFn = null,
  rediscoveryDelayMs = DOWNLOAD_RECOVERY_REDISCOVERY_DELAY_MS,
} = {}) {
  if (!libraryDiscoveryRequestStore?.scheduleDownloadRecoveryRediscovery) {
    throw new Error('libraryDiscoveryRequestStore.scheduleDownloadRecoveryRediscovery dependency is required');
  }
  if (!libraryDiscoveryRequestStore?.getDownloadRecoveryRediscoveryState) {
    throw new Error('libraryDiscoveryRequestStore.getDownloadRecoveryRediscoveryState dependency is required');
  }
  if (!libraryDiscoveryRequestStore?.markDownloadRecoveryRediscoveryExhausted) {
    throw new Error('libraryDiscoveryRequestStore.markDownloadRecoveryRediscoveryExhausted dependency is required');
  }

  async function scheduleDownloadRecoveryRediscovery({
    failedCandidateId,
    failureReason = null,
    metadataReleaseId,
    operationRunId = null,
    sourceSearchId = null,
  } = {}) {
    const releaseId = normalizeOptionalString(metadataReleaseId);
    if (!releaseId) {
      return {
        reason: 'metadata_release_unavailable',
        scheduled: false,
      };
    }

    const now = getNow();
    const nextSearchAfter = new Date(now.getTime() + rediscoveryDelayMs).toISOString();
    const discoveryRequest = await libraryDiscoveryRequestStore.scheduleDownloadRecoveryRediscovery({
      failureReason,
      maxResearchAttemptCount,
      metadataReleaseId: releaseId,
      nextSearchAfter,
      searchAttemptCount: DOWNLOAD_RECOVERY_REDISCOVERY_SEARCH_ATTEMPT_COUNT,
      sourceOperationRunId: operationRunId,
      sourceSearchId,
      triggeredByFailedCandidateId: failedCandidateId,
    });

    if (!discoveryRequest) {
      const currentRequest = await libraryDiscoveryRequestStore.getDownloadRecoveryRediscoveryState({
        metadataReleaseId: releaseId,
      });

      if (isFuturePendingRediscovery(currentRequest, now)) {
        return {
          metadataReleaseId: releaseId,
          nextSearchAfter: currentRequest.nextSearchAfter,
          reason: 'rediscovery_already_pending',
          researchAttemptCount: currentRequest.researchAttemptCount,
          scheduled: false,
          searchAttemptCount: currentRequest.searchAttemptCount,
        };
      }

      const exhaustedRequest = (currentRequest?.researchAttemptCount ?? 0) >= maxResearchAttemptCount
        ? await libraryDiscoveryRequestStore.markDownloadRecoveryRediscoveryExhausted({
          failureReason,
          maxResearchAttemptCount,
          metadataReleaseId: releaseId,
          sourceOperationRunId: operationRunId,
          sourceSearchId,
          triggeredByFailedCandidateId: failedCandidateId,
        }) ?? currentRequest
        : null;

      if (exhaustedRequest) {
        notifyDownloadRecoveryExhausted(onDownloadRecoveryExhaustedFn, {
          artistName: exhaustedRequest.artistName ?? null,
          maxResearchAttemptCount,
          metadataReleaseId: releaseId,
          releaseTitle: exhaustedRequest.releaseTitle ?? exhaustedRequest.releaseGroupTitle ?? null,
          researchAttemptCount: exhaustedRequest.researchAttemptCount,
        });

        return {
          exhausted: true,
          metadataReleaseId: releaseId,
          reason: 'rediscovery_exhausted',
          researchAttemptCount: exhaustedRequest.researchAttemptCount,
          scheduled: false,
        };
      }

      return {
        metadataReleaseId: releaseId,
        reason: 'rediscovery_not_scheduled',
        scheduled: false,
      };
    }

    const run = await createDiscoveryRun({
      nextAttemptAt: nextSearchAfter,
      status: 'pending',
      summary: {
        currentStep: 'queued by download recovery rediscovery',
        downloadRecoveryRediscovery: {
          failedCandidateId,
          metadataReleaseId: releaseId,
          nextSearchAfter,
          researchAttemptCount: discoveryRequest.researchAttemptCount,
          searchAttemptCount: discoveryRequest.searchAttemptCount,
          sourceOperationRunId: operationRunId,
          sourceSearchId,
        },
        triggerSource: 'download_recovery',
      },
      triggerSource: 'download_recovery',
      triggeredByUserId: null,
    });

    return {
      discoveryRunId: run?.id ?? null,
      metadataReleaseId: releaseId,
      nextSearchAfter,
      reason: 'rediscovery_scheduled',
      researchAttemptCount: discoveryRequest.researchAttemptCount,
      scheduled: true,
      searchAttemptCount: discoveryRequest.searchAttemptCount,
    };
  }

  return {
    scheduleDownloadRecoveryRediscovery,
  };
}
