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
import { recordAuditEvent } from '../audit.js';
import { buildProviderIngestPlan, normalizeExternalMediaSource } from './external-media-source-parser.js';
import { createLibraryMediaRequestStore } from './library-media-request-store.js';
import { createLibraryProviderIngestRequestStore } from './library-provider-ingest-request-store.js';
import { createLibraryExternalRequestActiveService } from './library-external-request-active-service.js';
import { isCollectionSource } from './provider-collection-cursor-policy.js';

export function createLibraryProviderIngestPlanningService({
  getNow = () => new Date(),
  mediaRequestStore = createLibraryMediaRequestStore(),
  getActiveExternalRequest = createLibraryExternalRequestActiveService({ mediaRequestStore }).getActiveExternalRequest,
  providerIngestRequestStore = createLibraryProviderIngestRequestStore(),
  recordAuditEventFn = recordAuditEvent,
  collectionIntakeService = null,
} = {}) {
  async function planExternalMediaRequest({ mediaRequestId, operationRunId = null, triggeredByUserId = null, triggerSource = 'request_submit' } = {}) {
    const mediaRequest = await getActiveExternalRequest({ mediaRequestId, operationRunId });

    const normalizedSource = normalizeExternalMediaSource(mediaRequest.sourceUrl);
    if (!normalizedSource) {
      throw createApiError(409, 'provider_url_not_supported', 'External provider URL could not be normalized into an ingest plan');
    }

    if (collectionIntakeService && isCollectionSource(normalizedSource)) {
      return collectionIntakeService.initializeCollection({ mediaRequestId, normalizedSource, operationRunId, triggeredByUserId });
    }

    const ingestPlan = buildProviderIngestPlan({ normalizedSource });
    const providerIngestRequests = await providerIngestRequestStore.replaceProviderIngestRequests({
      mediaRequestId,
      providerIngestRequests: ingestPlan,
    });
    await getActiveExternalRequest({ mediaRequestId, operationRunId });
    const plannedAt = getNow().toISOString();

    await mediaRequestStore.mergeMediaRequestEvidence({
      evidencePatch: {
        providerAutomation: {
          canonicalUrl: normalizedSource.canonicalUrl,
          operationRunId,
          plannedAt,
          plannedIngestRequestCount: providerIngestRequests.length,
          resourceType: normalizedSource.resourceType,
          sourceIdentifier: normalizedSource.sourceIdentifier,
          sourceProvider: normalizedSource.provider,
          status: 'planned',
          triggerSource,
        },
        providerRequest: {
          canonicalUrl: normalizedSource.canonicalUrl,
          relatedIdentifier: normalizedSource.relatedIdentifier,
          resourceType: normalizedSource.resourceType,
          sourceIdentifier: normalizedSource.sourceIdentifier,
          sourceProvider: normalizedSource.provider,
          storefront: normalizedSource.storefront,
        },
      },
      mediaRequestId,
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'app_user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        mediaRequestId,
        operationRunId,
        plannedIngestRequestCount: providerIngestRequests.length,
        resourceType: normalizedSource.resourceType,
        sourceIdentifier: normalizedSource.sourceIdentifier,
        sourceProvider: normalizedSource.provider,
        triggerSource,
      },
      entityId: mediaRequestId,
      entityType: 'media_request',
      eventType: 'provider_ingest_request_planned',
      summary: `Planned ${providerIngestRequests.length} provider ingest request${providerIngestRequests.length === 1 ? '' : 's'}`,
    });

    return {
      mediaRequestId,
      normalizedSource,
      plannedAt,
      providerIngestRequests,
    };
  }

  return {
    planExternalMediaRequest,
  };
}
