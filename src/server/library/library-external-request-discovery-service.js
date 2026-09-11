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

import { createApiError } from '../auth.js';
import { buildMediaRequestTargetEligibility } from '../media-request-target-eligibility.js';
import {
  createOperationRunCancellationError,
  throwIfOperationRunCancellationRequested,
} from '../operation-run-cancellation.js';
import { buildDiscoverySearchQuery } from './library-discovery-search-query.js';

export function createLibraryExternalRequestDiscoveryService({
  assertMaintenanceWriteAllowed = async () => {},
  getAppUserById,
  getReleaseTracklistExpectationsFn = null,
  importCandidateService,
  isCancellationRequested = async () => false,
  mediaRequestStore,
  reviewStore,
  slskdService,
} = {}) {
  async function discoverExternalRequestRelease({
    intentId,
    mediaRequestId,
    operationRunId = null,
    triggeredByUserId = null,
  }) {
    const intent = await reviewStore.getIntentById({ intentId });
    if (!intent || intent.mediaRequestId !== mediaRequestId) {
      throw createApiError(404, 'external_request_intent_not_found', 'The approved release could not be found');
    }

    async function assertCurrentTarget({ queryable = null } = {}) {
      await throwIfOperationRunCancellationRequested({ isCancellationRequested, queryable, runId: operationRunId });
      await assertMaintenanceWriteAllowed({ queryable });
      if (queryable) {
        await reviewStore.lockRequest({ mediaRequestId, queryable });
      }
      const request = await mediaRequestStore.getMediaRequestById({ mediaRequestId, queryable });
      const target = await getAppUserById({ userId: intent.requestedForUserId, queryable });
      if (!request || request.requestKind !== 'external_url' || request.requestState !== 'needs_fetch'
        || request.requestedForUser?.id !== intent.requestedForUserId
        || target?.id !== intent.requestedForUserId
        || !buildMediaRequestTargetEligibility(target).eligible) {
        throw createOperationRunCancellationError({
          message: 'External request discovery stopped because the request or its target is no longer eligible',
          runId: operationRunId,
        });
      }
      return request;
    }

    const request = await assertCurrentTarget();
    const query = buildDiscoverySearchQuery({ artistName: intent.artistName, releaseTitle: intent.releaseTitle });
    if (!intent.artistName?.trim() || !intent.releaseTitle?.trim() || !query) {
      throw createApiError(409, 'external_request_release_metadata_missing', 'The approved release needs artist and title metadata before discovery');
    }
    const expectations = getReleaseTracklistExpectationsFn
      ? await getReleaseTracklistExpectationsFn({ metadataReleaseId: intent.metadataReleaseId })
      : null;
    await assertCurrentTarget();
    // Each intent starts its own search: candidate identity and placement remain target-owned.
    const search = await slskdService.startSearch({ query });
    await assertCurrentTarget();
    const result = await importCandidateService.ingestSlskdSearchResponses({
      actorUserId: triggeredByUserId,
      albumTitle: intent.releaseTitle,
      beforePersistCandidates: assertCurrentTarget,
      discoveryScope: { metadataReleaseId: intent.metadataReleaseId },
      expectedDurationSeconds: expectations?.expectedDurationSeconds ?? null,
      expectedTrackCount: expectations?.expectedTrackCount ?? null,
      expectedTrackTitles: expectations?.expectedTrackTitles ?? null,
      requestOwnership: {
        externalRequestReleaseIntentId: intent.id,
        metadataReleaseGroupId: intent.releaseGroupId,
        metadataReleaseId: intent.metadataReleaseId,
        sourceMediaRequestId: mediaRequestId,
        sourceRequestKind: 'external_url',
        sourceRequestedByUserId: request.requestedByUser?.id ?? null,
        sourceRequestedForUserId: intent.requestedForUserId,
        sourceType: 'media_request',
      },
      searchId: search.id,
    });
    return {
      candidateCount: result.candidateCount,
      fileCount: result.fileCount,
      intentId,
      mediaRequestId,
      metadataReleaseId: intent.metadataReleaseId,
      searchId: result.sourceSearchId ?? search.id,
    };
  }

  return { discoverExternalRequestRelease };
}
