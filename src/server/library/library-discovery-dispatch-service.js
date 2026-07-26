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

import { createLibraryDiscoveryRequestStore } from './library-discovery-request-store.js';
import {
  buildDiscoverySearchQuery,
} from './library-discovery-search-query.js';
import {
  MAX_TRACK_FALLBACK_QUERIES,
  buildPerTrackDiscoveryQueries,
} from './library-discovery-track-fallback-query.js';
import {
  buildMusicQueueProviderRecoverySearchStartedActivityEvent,
  recordActivityEventSafely,
} from '../activity/music-queue-lifecycle-activity-event-service.js';
import { loadSettings } from '../settings.js';

export const DEFAULT_DISCOVERY_SETTINGS = Object.freeze({
  automaticCooldownMs: 6 * 60 * 60 * 1000,
  dispatchBatchSize: 5,
  fallbackCooldownMs: 2 * 60 * 60 * 1000,
  maxSearchAttempts: 3,
});

export { buildDiscoverySearchQuery };

export function resolveDiscoverySettings(settings) {
  const library = settings?.library && typeof settings.library === 'object'
    ? settings.library
    : {};

  return {
    automaticCooldownMs: Number.isInteger(library.discoveryCooldownHours)
      ? library.discoveryCooldownHours * 60 * 60 * 1000
      : DEFAULT_DISCOVERY_SETTINGS.automaticCooldownMs,
    dispatchBatchSize: Number.isInteger(library.discoveryBatchSize)
      ? library.discoveryBatchSize
      : DEFAULT_DISCOVERY_SETTINGS.dispatchBatchSize,
    fallbackCooldownMs: Number.isInteger(library.discoveryFallbackCooldownHours)
      ? library.discoveryFallbackCooldownHours * 60 * 60 * 1000
      : DEFAULT_DISCOVERY_SETTINGS.fallbackCooldownMs,
    maxSearchAttempts: Number.isInteger(library.maxSearchAttempts)
      ? library.maxSearchAttempts
      : DEFAULT_DISCOVERY_SETTINGS.maxSearchAttempts,
  };
}

export function createLibraryDiscoveryDispatchService({
  automaticCooldownMs: _automaticCooldownMs = DEFAULT_DISCOVERY_SETTINGS.automaticCooldownMs,
  dispatchBatchSize: _dispatchBatchSize = DEFAULT_DISCOVERY_SETTINGS.dispatchBatchSize,
  enableTrackFallback = false,
  fallbackCooldownMs: _fallbackCooldownMs = DEFAULT_DISCOVERY_SETTINGS.fallbackCooldownMs,
  getNow = () => new Date(),
  getReleaseTracklistExpectationsFn = null,
  getUserPreferencesFn = null,
  importCandidateAutoDownloadRunService = null,
  importCandidateAutoSelectionService = null,
  importCandidateService = null,
  libraryDiscoveryRequestStore = createLibraryDiscoveryRequestStore(),
  loadSettingsFn = loadSettings,
  onDiscoveryRequestExhaustedFn = null,
  recordActivityEventFn = null,
  slskdService = null,
  trackFallbackMaxQueries = MAX_TRACK_FALLBACK_QUERIES,
} = {}) {
  function buildRequestOwnershipContext(claimedRequest) {
    const sourceRequestedByUserId = claimedRequest?.evidence?.sourceRequestedByUserId ?? null;
    const sourceRequestedForUserId = claimedRequest?.evidence?.sourceRequestedForUserId ?? sourceRequestedByUserId ?? null;

    if (!sourceRequestedForUserId) {
      return null;
    }

    return {
      metadataArtistId: claimedRequest?.metadataArtistId ?? null,
      metadataReleaseGroupId: claimedRequest?.metadataReleaseGroupId ?? null,
      metadataReleaseId: claimedRequest?.metadataReleaseId ?? null,
      sourceMediaRequestId: claimedRequest?.evidence?.sourceMediaRequestId ?? null,
      sourceRequestKind: claimedRequest?.evidence?.sourceRequestKind ?? null,
      sourceRequestedByUserId,
      sourceRequestedForUserId,
      sourceType: 'media_request',
    };
  }

  function buildNextZeroCandidateSchedule({
    automaticCooldownMs: effectiveAutomaticCooldownMs,
    dispatchedAt,
    fallbackCooldownMs: effectiveFallbackCooldownMs,
    maxSearchAttempts: effectiveMaxSearchAttempts,
    searchAttemptCount,
  }) {
    const completedAttemptCount = (Number.isInteger(searchAttemptCount) && searchAttemptCount > 0
      ? searchAttemptCount
      : 0) + 1;

    if (completedAttemptCount >= effectiveMaxSearchAttempts) {
      return {
        exhausted: true,
        nextSearchAfter: null,
        searchAttemptCount: completedAttemptCount,
      };
    }

    const cooldownMs = searchAttemptCount >= 1 ? effectiveFallbackCooldownMs : effectiveAutomaticCooldownMs;
    return {
      exhausted: false,
      nextSearchAfter: new Date(dispatchedAt.getTime() + cooldownMs).toISOString(),
      searchAttemptCount: completedAttemptCount,
    };
  }

  function notifyDiscoveryExhausted(payload) {
    if (typeof onDiscoveryRequestExhaustedFn !== 'function') {
      return;
    }

    void onDiscoveryRequestExhaustedFn(payload).catch(() => {});
  }

  function resolveQualityProfileCode({ claimedRequest, userPreferences } = {}) {
    const explicitProfile = claimedRequest?.evidence?.qualityProfile
      ?? claimedRequest?.evidence?.acquisitionProfile;
    if (typeof explicitProfile === 'string' && explicitProfile.trim().length > 0) {
      return explicitProfile.trim();
    }

    if (userPreferences?.minimumQuality === 'any' && (!userPreferences?.preferredFormat || userPreferences.preferredFormat === 'any')) {
      return 'any_available';
    }

    if (
      userPreferences?.minimumQuality === 'high'
      || userPreferences?.preferredFormat === 'mp3_320'
      || userPreferences?.preferredFormat === 'mp3_v0'
    ) {
      return 'high_quality';
    }

    return 'lossless_archive';
  }

  function buildAutoSelectionQualityContext({ claimedRequest, userPreferences } = {}) {
    const qualityOverride = claimedRequest?.evidence?.musicQueueQualityOverride ?? null;
    const wantedReleaseId = qualityOverride?.wantedReleaseId
      ?? claimedRequest?.evidence?.musicQueueRediscovery?.wantedReleaseId
      ?? null;
    return {
      profileCode: resolveQualityProfileCode({ claimedRequest, userPreferences }),
      qualityOverride,
      ...(wantedReleaseId ? { wantedReleaseId } : {}),
    };
  }

  async function recordProviderRecoverySearchStarted({ claimedRequest }) {
    if (
      !claimedRequest?.discoveryRequestId
      || !claimedRequest?.evidence?.providerRecoveryPending
      || typeof libraryDiscoveryRequestStore.consumeProviderRecoveryPending !== 'function'
    ) {
      return;
    }

    let providerRecovery;
    try {
      providerRecovery = await libraryDiscoveryRequestStore.consumeProviderRecoveryPending({
        discoveryRequestId: claimedRequest.discoveryRequestId,
      });
    } catch {
      return;
    }

    if (!providerRecovery) {
      return;
    }

    recordActivityEventSafely(
      recordActivityEventFn,
      buildMusicQueueProviderRecoverySearchStartedActivityEvent({ claimedRequest }),
    );
  }

  async function selectHighConfidenceCandidateAfterIngestion({
    actorUserId,
    profileCode,
    qualityOverride,
    requestMetadata,
    sourceSearchId,
  }) {
    if (typeof importCandidateAutoSelectionService?.selectHighConfidenceCandidate !== 'function') {
      return null;
    }

    try {
      return await importCandidateAutoSelectionService.selectHighConfidenceCandidate({
        actorUserId,
        profileCode,
        qualityOverride,
        requestMetadata,
        sourceSearchId,
      });
    } catch (error) {
      return {
        attempted: true,
        errorCode: error?.code ?? 'auto_selection_failed',
        selected: false,
        skippedReason: 'auto_selection_failed',
        sourceSearchId,
      };
    }
  }

  async function startDownloadRunAfterAutoSelection({
    actorUserId,
    autoSelectionResult,
    requestMetadata,
    sourceSearchId,
  }) {
    if (typeof importCandidateAutoDownloadRunService?.startDownloadRunAfterAutoSelection !== 'function') {
      return null;
    }

    try {
      return await importCandidateAutoDownloadRunService.startDownloadRunAfterAutoSelection({
        actorUserId,
        autoSelectionResult,
        requestMetadata,
        sourceSearchId,
      });
    } catch (error) {
      return {
        attempted: true,
        errorCode: error?.code ?? 'auto_download_start_failed',
        message: error?.message ?? 'Automatic download start failed',
        selectedCandidateId: autoSelectionResult?.selectedCandidateId ?? null,
        skippedReason: 'auto_download_start_failed',
        sourceSearchId,
        started: false,
      };
    }
  }

  async function checkAutomaticDownloadReadiness() {
    if (typeof importCandidateAutoDownloadRunService?.checkAutomaticDownloadReadiness !== 'function') {
      return null;
    }

    try {
      return await importCandidateAutoDownloadRunService.checkAutomaticDownloadReadiness();
    } catch {
      return {
        message: 'Harmoniarr could not verify folder setup before starting a download.',
        ready: false,
        setupReason: 'download_folder_unavailable',
      };
    }
  }

  async function dispatchTrackFallbackSearches({
    actorUserId,
    claimedRequest,
    formatPreferences,
    requestMetadata,
    requestOwnership,
    tracklistExpectations,
    userPreferences,
  }) {
    const summary = {
      candidateCount: 0,
      dispatchedSearches: [],
      fileCount: 0,
      queryCount: 0,
    };

    if (!enableTrackFallback) {
      return summary;
    }

    const trackQueries = buildPerTrackDiscoveryQueries({
      artistName: claimedRequest.artistName,
      expectedTrackTitles: tracklistExpectations?.expectedTrackTitles ?? null,
      preferredFormat: userPreferences?.preferredFormat,
      maxQueries: trackFallbackMaxQueries,
    });

    if (trackQueries.length === 0) {
      return summary;
    }

    const albumTitle = claimedRequest.releaseTitle ?? claimedRequest.releaseGroupTitle ?? null;

    for (const { query, trackTitle } of trackQueries) {
      summary.queryCount += 1;
      try {
        const search = await slskdService.startSearch({ query });
        const qualityContext = buildAutoSelectionQualityContext({
          claimedRequest,
          userPreferences,
        });
        const ingestionResult = await importCandidateService.ingestSlskdSearchResponses({
          actorUserId,
          albumTitle,
          expectedTrackTitles: [trackTitle],
          expectedTrackCount: 1,
          expectedDurationSeconds: null,
          formatPreferences,
          musicQueueContext: qualityContext,
          requestOwnership,
          requestMetadata,
          searchId: search.id,
        });
        const autoDownloadReadiness = ingestionResult.candidateCount > 0
          ? await checkAutomaticDownloadReadiness()
          : null;
        const autoSelectionResult = ingestionResult.candidateCount > 0 && autoDownloadReadiness?.ready !== false
          ? await selectHighConfidenceCandidateAfterIngestion({
            actorUserId,
            ...qualityContext,
            requestMetadata,
            sourceSearchId: search.id,
          })
          : null;
        const autoDownloadStartResult = autoSelectionResult?.selected
          ? await startDownloadRunAfterAutoSelection({
            actorUserId,
            autoSelectionResult,
            requestMetadata,
            sourceSearchId: search.id,
          })
          : null;

        summary.candidateCount += ingestionResult.candidateCount;
        summary.fileCount += ingestionResult.fileCount;
        const dispatchedSearch = {
          candidateCount: ingestionResult.candidateCount,
          fileCount: ingestionResult.fileCount,
          metadataReleaseId: claimedRequest.metadataReleaseId,
          mode: 'track_fallback',
          query,
          searchId: search.id,
          trackTitle,
        };
        if (autoSelectionResult) {
          dispatchedSearch.autoSelection = autoSelectionResult;
        }
        if (autoDownloadReadiness) {
          dispatchedSearch.autoDownloadReadiness = autoDownloadReadiness;
        }
        if (autoDownloadStartResult) {
          dispatchedSearch.autoDownloadStart = autoDownloadStartResult;
        }
        summary.dispatchedSearches.push(dispatchedSearch);
      } catch {
        // A single failing per-track search must not abort the remaining tracks
        // or the surrounding album-exhaustion handling.
      }
    }

    return summary;
  }

  async function dispatchReadyDiscoveryRequests({
    actorUserId = null,
    requestMetadata = null,
  } = {}) {
    if (!importCandidateService?.ingestSlskdSearchResponses || !slskdService?.startSearch) {
      return {
        attemptedCount: 0,
        candidateCount: 0,
        dispatchedCount: 0,
        dispatchedSearches: [],
        failedCount: 0,
        failures: [],
        fileCount: 0,
      };
    }

    let effectiveSettings;
    try {
      effectiveSettings = resolveDiscoverySettings(await loadSettingsFn());
    } catch {
      effectiveSettings = DEFAULT_DISCOVERY_SETTINGS;
    }
    const effectiveAutomaticCooldownMs = effectiveSettings.automaticCooldownMs;
    const effectiveDispatchBatchSize = effectiveSettings.dispatchBatchSize;
    const effectiveFallbackCooldownMs = effectiveSettings.fallbackCooldownMs;
    const effectiveMaxSearchAttempts = effectiveSettings.maxSearchAttempts;

    const failures = [];
    const dispatchedSearches = [];
    let attemptedCount = 0;
    let candidateCount = 0;
    let fileCount = 0;

    for (let index = 0; index < effectiveDispatchBatchSize; index += 1) {
      const dispatchedAt = getNow();
      const dispatchedAtIso = dispatchedAt.toISOString();
      const nextSearchAfter = new Date(dispatchedAt.getTime() + effectiveAutomaticCooldownMs).toISOString();
      const claimedRequest = await libraryDiscoveryRequestStore.claimNextReadyAutomaticDiscoveryRequest({
        dispatchedAt: dispatchedAtIso,
        nextSearchAfter,
      });

      if (!claimedRequest) {
        break;
      }

      attemptedCount += 1;

      const ownership = buildRequestOwnershipContext(claimedRequest);
      let userPreferences = null;
      if (getUserPreferencesFn && ownership?.sourceRequestedForUserId) {
        try {
          userPreferences = await getUserPreferencesFn({ userId: ownership.sourceRequestedForUserId });
        } catch {
          userPreferences = null;
        }
      }

      const searchQuery = buildDiscoverySearchQuery({
        ...claimedRequest,
        preferredFormat: userPreferences?.preferredFormat,
      });
      if (!searchQuery) {
        const terminalSearchAttemptCount = Math.max(
          claimedRequest.searchAttemptCount ?? 0,
          effectiveMaxSearchAttempts,
        );
        const failure = {
          code: claimedRequest.searchAttemptCount >= effectiveMaxSearchAttempts
            ? 'discovery_search_attempts_exhausted'
            : 'discovery_search_query_invalid',
          message: claimedRequest.searchAttemptCount >= effectiveMaxSearchAttempts
            ? 'Discovery request exhausted all automatic search query fallback attempts'
            : 'Discovery request did not contain enough metadata to build a search query',
          metadataReleaseId: claimedRequest.metadataReleaseId,
        };
        failures.push(failure);
        await libraryDiscoveryRequestStore.markDiscoveryRequestExhausted({
          metadataReleaseId: claimedRequest.metadataReleaseId,
          reasonCode: failure.code,
          searchAttemptCount: terminalSearchAttemptCount,
          searchQuery: null,
        });
        notifyDiscoveryExhausted({
          artistName: claimedRequest.artistName,
          metadataReleaseId: claimedRequest.metadataReleaseId,
          reasonCode: failure.code,
          releaseTitle: claimedRequest.releaseTitle ?? claimedRequest.releaseGroupTitle ?? null,
          searchAttemptCount: terminalSearchAttemptCount,
        });
        continue;
      }

      try {
        const search = await slskdService.startSearch({
          query: searchQuery,
        });
        await recordProviderRecoverySearchStarted({ claimedRequest });
        const requestOwnership = ownership;

        let tracklistExpectations = null;
        if (getReleaseTracklistExpectationsFn && claimedRequest.metadataReleaseId) {
          try {
            tracklistExpectations = await getReleaseTracklistExpectationsFn({
              metadataReleaseId: claimedRequest.metadataReleaseId,
            });
          } catch {
            tracklistExpectations = null;
          }
        }

        const formatPreferences = userPreferences ? {
          minimumQuality: userPreferences.minimumQuality,
          preferredFormat: userPreferences.preferredFormat,
        } : null;
        const qualityContext = buildAutoSelectionQualityContext({
          claimedRequest,
          userPreferences,
        });

        const ingestionResult = await importCandidateService.ingestSlskdSearchResponses({
          actorUserId,
          albumTitle: claimedRequest.releaseTitle ?? claimedRequest.releaseGroupTitle ?? null,
          expectedTrackTitles: tracklistExpectations?.expectedTrackTitles ?? null,
          expectedTrackCount: tracklistExpectations?.expectedTrackCount ?? null,
          expectedDurationSeconds: tracklistExpectations?.expectedDurationSeconds ?? null,
          formatPreferences,
          musicQueueContext: qualityContext,
          requestOwnership,
          requestMetadata,
          searchId: search.id,
        });
        const autoDownloadReadiness = ingestionResult.candidateCount > 0
          ? await checkAutomaticDownloadReadiness()
          : null;
        const autoSelectionResult = ingestionResult.candidateCount > 0 && autoDownloadReadiness?.ready !== false
          ? await selectHighConfidenceCandidateAfterIngestion({
            actorUserId,
            ...qualityContext,
            requestMetadata,
            sourceSearchId: search.id,
          })
          : null;
        const autoDownloadStartResult = autoSelectionResult?.selected
          ? await startDownloadRunAfterAutoSelection({
            actorUserId,
            autoSelectionResult,
            requestMetadata,
            sourceSearchId: search.id,
          })
          : null;
        candidateCount += ingestionResult.candidateCount;
        fileCount += ingestionResult.fileCount;
        const zeroCandidateSchedule = ingestionResult.candidateCount === 0
          ? buildNextZeroCandidateSchedule({
            automaticCooldownMs: effectiveAutomaticCooldownMs,
            dispatchedAt,
            fallbackCooldownMs: effectiveFallbackCooldownMs,
            maxSearchAttempts: effectiveMaxSearchAttempts,
            searchAttemptCount: claimedRequest.searchAttemptCount ?? 0,
          })
          : null;
        const dispatchedSearch = {
          candidateCount: ingestionResult.candidateCount,
          fileCount: ingestionResult.fileCount,
          metadataReleaseId: claimedRequest.metadataReleaseId,
          query: searchQuery,
          searchId: search.id,
        };
        if (autoSelectionResult) {
          dispatchedSearch.autoSelection = autoSelectionResult;
        }
        if (autoDownloadReadiness) {
          dispatchedSearch.autoDownloadReadiness = autoDownloadReadiness;
        }
        if (autoDownloadStartResult) {
          dispatchedSearch.autoDownloadStart = autoDownloadStartResult;
        }
        dispatchedSearches.push(dispatchedSearch);

        const successPayload = {
          candidateCount: ingestionResult.candidateCount,
          fileCount: ingestionResult.fileCount,
          metadataReleaseId: claimedRequest.metadataReleaseId,
          searchId: search.id,
          searchQuery,
        };
        if (ingestionResult.ingestionDiagnostics) {
          successPayload.ingestionDiagnostics = ingestionResult.ingestionDiagnostics;
        }
        if (autoSelectionResult) {
          successPayload.autoSelection = autoSelectionResult;
        }
        if (autoDownloadReadiness) {
          successPayload.autoDownloadReadiness = autoDownloadReadiness;
        }
        if (autoDownloadStartResult) {
          successPayload.autoDownloadStart = autoDownloadStartResult;
        }
        if (zeroCandidateSchedule) {
          successPayload.nextSearchAfter = zeroCandidateSchedule.nextSearchAfter;
          successPayload.searchAttemptCount = zeroCandidateSchedule.searchAttemptCount;
        }

        await libraryDiscoveryRequestStore.recordDiscoverySearchSuccess(successPayload);

        if (zeroCandidateSchedule?.exhausted) {
          const trackFallbackSummary = await dispatchTrackFallbackSearches({
            actorUserId,
            claimedRequest,
            formatPreferences,
            requestMetadata,
            requestOwnership,
            tracklistExpectations,
            userPreferences,
          });

          if (trackFallbackSummary.queryCount > 0) {
            candidateCount += trackFallbackSummary.candidateCount;
            fileCount += trackFallbackSummary.fileCount;
            for (const trackSearch of trackFallbackSummary.dispatchedSearches) {
              dispatchedSearches.push(trackSearch);
            }
          }

          const exhaustionReasonCode = trackFallbackSummary.queryCount > 0
            ? 'discovery_track_fallback_exhausted'
            : 'discovery_search_attempts_exhausted';

          await libraryDiscoveryRequestStore.markDiscoveryRequestExhausted({
            metadataReleaseId: claimedRequest.metadataReleaseId,
            reasonCode: exhaustionReasonCode,
            searchAttemptCount: zeroCandidateSchedule.searchAttemptCount,
            searchQuery,
          });
          notifyDiscoveryExhausted({
            artistName: claimedRequest.artistName,
            metadataReleaseId: claimedRequest.metadataReleaseId,
            reasonCode: exhaustionReasonCode,
            releaseTitle: claimedRequest.releaseTitle ?? claimedRequest.releaseGroupTitle ?? null,
            searchAttemptCount: zeroCandidateSchedule.searchAttemptCount,
          });
        }
      } catch (error) {
        const failure = {
          code: error?.code ?? 'discovery_dispatch_failed',
          message: error?.message ?? 'Discovery dispatch failed',
          metadataReleaseId: claimedRequest.metadataReleaseId,
        };
        failures.push(failure);
        await libraryDiscoveryRequestStore.recordDiscoverySearchFailure({
          errorCode: failure.code,
          errorMessage: failure.message,
          metadataReleaseId: claimedRequest.metadataReleaseId,
          searchQuery,
        });
      }
    }

    return {
      attemptedCount,
      candidateCount,
      dispatchedCount: dispatchedSearches.length,
      dispatchedSearches,
      failedCount: failures.length,
      failures,
      fileCount,
    };
  }

  return {
    dispatchReadyDiscoveryRequests,
  };
}
