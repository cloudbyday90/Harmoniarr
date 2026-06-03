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
  MAX_DISCOVERY_SEARCH_ATTEMPTS,
  buildDiscoverySearchQuery,
} from './library-discovery-search-query.js';
import {
  MAX_TRACK_FALLBACK_QUERIES,
  buildPerTrackDiscoveryQueries,
} from './library-discovery-track-fallback-query.js';

const defaultAutomaticCooldownMs = 6 * 60 * 60 * 1000;
const defaultDispatchBatchSize = 5;
const defaultFallbackCooldownMs = 2 * 60 * 60 * 1000;

export { buildDiscoverySearchQuery };

export function createLibraryDiscoveryDispatchService({
  automaticCooldownMs = defaultAutomaticCooldownMs,
  dispatchBatchSize = defaultDispatchBatchSize,
  enableTrackFallback = false,
  fallbackCooldownMs = defaultFallbackCooldownMs,
  getNow = () => new Date(),
  getReleaseTracklistExpectationsFn = null,
  getUserPreferencesFn = null,
  importCandidateService = null,
  libraryDiscoveryRequestStore = createLibraryDiscoveryRequestStore(),
  onDiscoveryRequestExhaustedFn = null,
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

  function buildNextZeroCandidateSchedule({ dispatchedAt, searchAttemptCount }) {
    const completedAttemptCount = (Number.isInteger(searchAttemptCount) && searchAttemptCount > 0
      ? searchAttemptCount
      : 0) + 1;

    if (completedAttemptCount >= MAX_DISCOVERY_SEARCH_ATTEMPTS) {
      return {
        exhausted: true,
        nextSearchAfter: null,
        searchAttemptCount: completedAttemptCount,
      };
    }

    const cooldownMs = searchAttemptCount >= 1 ? fallbackCooldownMs : automaticCooldownMs;
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
        const ingestionResult = await importCandidateService.ingestSlskdSearchResponses({
          actorUserId,
          albumTitle,
          expectedTrackTitles: [trackTitle],
          expectedTrackCount: 1,
          expectedDurationSeconds: null,
          formatPreferences,
          requestOwnership,
          requestMetadata,
          searchId: search.id,
        });

        summary.candidateCount += ingestionResult.candidateCount;
        summary.fileCount += ingestionResult.fileCount;
        summary.dispatchedSearches.push({
          candidateCount: ingestionResult.candidateCount,
          fileCount: ingestionResult.fileCount,
          metadataReleaseId: claimedRequest.metadataReleaseId,
          mode: 'track_fallback',
          query,
          searchId: search.id,
          trackTitle,
        });
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

    const failures = [];
    const dispatchedSearches = [];
    let attemptedCount = 0;
    let candidateCount = 0;
    let fileCount = 0;

    for (let index = 0; index < dispatchBatchSize; index += 1) {
      const dispatchedAt = getNow();
      const dispatchedAtIso = dispatchedAt.toISOString();
      const nextSearchAfter = new Date(dispatchedAt.getTime() + automaticCooldownMs).toISOString();
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
          MAX_DISCOVERY_SEARCH_ATTEMPTS,
        );
        const failure = {
          code: claimedRequest.searchAttemptCount >= MAX_DISCOVERY_SEARCH_ATTEMPTS
            ? 'discovery_search_attempts_exhausted'
            : 'discovery_search_query_invalid',
          message: claimedRequest.searchAttemptCount >= MAX_DISCOVERY_SEARCH_ATTEMPTS
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

        const ingestionResult = await importCandidateService.ingestSlskdSearchResponses({
          actorUserId,
          albumTitle: claimedRequest.releaseTitle ?? claimedRequest.releaseGroupTitle ?? null,
          expectedTrackTitles: tracklistExpectations?.expectedTrackTitles ?? null,
          expectedTrackCount: tracklistExpectations?.expectedTrackCount ?? null,
          expectedDurationSeconds: tracklistExpectations?.expectedDurationSeconds ?? null,
          formatPreferences,
          requestOwnership,
          requestMetadata,
          searchId: search.id,
        });
        candidateCount += ingestionResult.candidateCount;
        fileCount += ingestionResult.fileCount;
        const zeroCandidateSchedule = ingestionResult.candidateCount === 0
          ? buildNextZeroCandidateSchedule({
            dispatchedAt,
            searchAttemptCount: claimedRequest.searchAttemptCount ?? 0,
          })
          : null;
        dispatchedSearches.push({
          candidateCount: ingestionResult.candidateCount,
          fileCount: ingestionResult.fileCount,
          metadataReleaseId: claimedRequest.metadataReleaseId,
          query: searchQuery,
          searchId: search.id,
        });

        const successPayload = {
          candidateCount: ingestionResult.candidateCount,
          fileCount: ingestionResult.fileCount,
          metadataReleaseId: claimedRequest.metadataReleaseId,
          searchId: search.id,
          searchQuery,
        };
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
