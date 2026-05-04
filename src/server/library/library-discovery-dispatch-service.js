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

const defaultAutomaticCooldownMs = 6 * 60 * 60 * 1000;
const defaultDispatchBatchSize = 5;

function normalizeQueryPart(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function getReleaseYear(releaseDate) {
  if (typeof releaseDate !== 'string') {
    return null;
  }

  const match = releaseDate.match(/^(\d{4})-/);
  return match?.[1] ?? null;
}

export function buildDiscoverySearchQuery({
  artistName,
  releaseDate,
  releaseGroupTitle,
  releaseTitle,
}) {
  const title = normalizeQueryPart(releaseTitle) ?? normalizeQueryPart(releaseGroupTitle);
  const queryParts = [
    normalizeQueryPart(artistName),
    title,
    getReleaseYear(releaseDate),
  ].filter(Boolean);

  return queryParts.join(' ');
}

export function createLibraryDiscoveryDispatchService({
  automaticCooldownMs = defaultAutomaticCooldownMs,
  dispatchBatchSize = defaultDispatchBatchSize,
  getNow = () => new Date(),
  importCandidateService = null,
  libraryDiscoveryRequestStore = createLibraryDiscoveryRequestStore(),
  slskdService = null,
} = {}) {
  function buildRequestOwnershipContext(claimedRequest) {
    const sourceRequestedByUserId = claimedRequest?.evidence?.sourceRequestedByUserId ?? null;
    const sourceRequestedForUserId = claimedRequest?.evidence?.sourceRequestedForUserId ?? sourceRequestedByUserId ?? null;

    if (!sourceRequestedForUserId) {
      return null;
    }

    return {
      sourceMediaRequestId: claimedRequest?.evidence?.sourceMediaRequestId ?? null,
      sourceRequestKind: claimedRequest?.evidence?.sourceRequestKind ?? null,
      sourceRequestedByUserId,
      sourceRequestedForUserId,
      sourceType: 'media_request',
    };
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

      const searchQuery = buildDiscoverySearchQuery(claimedRequest);
      if (!searchQuery) {
        const failure = {
          code: 'discovery_search_query_invalid',
          message: 'Discovery request did not contain enough metadata to build a search query',
          metadataReleaseId: claimedRequest.metadataReleaseId,
        };
        failures.push(failure);
        await libraryDiscoveryRequestStore.recordDiscoverySearchFailure({
          errorCode: failure.code,
          errorMessage: failure.message,
          metadataReleaseId: claimedRequest.metadataReleaseId,
          searchQuery: null,
        });
        continue;
      }

      try {
        const search = await slskdService.startSearch({
          query: searchQuery,
        });
        const requestOwnership = buildRequestOwnershipContext(claimedRequest);
        const ingestionResult = await importCandidateService.ingestSlskdSearchResponses({
          actorUserId,
          requestOwnership,
          requestMetadata,
          searchId: search.id,
        });

        candidateCount += ingestionResult.candidateCount;
        fileCount += ingestionResult.fileCount;
        dispatchedSearches.push({
          candidateCount: ingestionResult.candidateCount,
          fileCount: ingestionResult.fileCount,
          metadataReleaseId: claimedRequest.metadataReleaseId,
          query: searchQuery,
          searchId: search.id,
        });

        await libraryDiscoveryRequestStore.recordDiscoverySearchSuccess({
          candidateCount: ingestionResult.candidateCount,
          fileCount: ingestionResult.fileCount,
          metadataReleaseId: claimedRequest.metadataReleaseId,
          searchId: search.id,
          searchQuery,
        });
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