/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { createAppUserService } from '../app-user-service.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { createMetadataSearchService } from '../metadata/metadata-search-service.js';
import { normalizeExternalMediaSource } from './external-media-source-parser.js';
import { createLibraryMediaRequestStore } from './library-media-request-store.js';
import { createLibraryProviderIngestRequestStore } from './library-provider-ingest-request-store.js';
import { createLibraryExternalIntakeRunStore } from './library-external-intake-run-store.js';
import { createLibraryExternalIntakeService } from './library-external-intake-service.js';
import { createLibraryProviderIngestExecutionRunStore } from './library-provider-ingest-execution-run-store.js';
import { createLibraryExternalRequestDiscoveryRunStore } from './library-external-request-discovery-run-store.js';
import { createLibraryExternalRequestReviewStore } from './library-external-request-review-store.js';
import { buildExternalRequestPreparationState, projectExternalRequestReviewItem } from './library-external-request-review-evidence.js';
import { createLibraryExternalRequestReviewAccessService, normalizeExternalReviewId as uuid } from './library-external-request-review-access-service.js';

function conflict() {
  return createApiError(409, 'external_request_review_conflict', 'This provider album or release already has a different approval. Review the existing decision.');
}

export function createLibraryExternalRequestReviewService({
  reviewStore = createLibraryExternalRequestReviewStore(),
  mediaRequestStore = createLibraryMediaRequestStore(),
  providerIngestRequestStore = createLibraryProviderIngestRequestStore(),
  discoveryRunStore = createLibraryExternalRequestDiscoveryRunStore(),
  planningRunStore = createLibraryExternalIntakeRunStore(),
  executionRunStore = createLibraryProviderIngestExecutionRunStore(),
  externalIntakeService = createLibraryExternalIntakeService({
    createOperationRun: planningRunStore.createOperationRun,
    getActiveRunByMediaRequestId: planningRunStore.getActiveRunByMediaRequestId,
    mediaRequestStore,
  }),
  getAppUserById = createAppUserService().getAppUserById,
  withTransaction = createDatabaseTransactionRunner(),
  recordAuditEventFn = recordAuditEvent,
  assertMaintenanceWriteAllowed = async () => {},
  metadataSearchService = null,
  collectionReviewService = null,
} = {}) {
  const { loadRequest, assertEligibleTarget } = createLibraryExternalRequestReviewAccessService({ mediaRequestStore, getAppUserById });

  async function activePreparation(mediaRequestId, queryable = null) {
    return await planningRunStore.getActiveRunByMediaRequestId(mediaRequestId, queryable)
      ?? await executionRunStore.getActiveRunByMediaRequestId(mediaRequestId, queryable);
  }

  async function buildReview({ mediaRequestId, cursor, limit }) {
    const collectionReview = await collectionReviewService?.buildReview({ mediaRequestId, cursor, limit });
    if (collectionReview) return collectionReview;
    const request = await loadRequest(mediaRequestId);
    const rows = await providerIngestRequestStore.listProviderIngestRequests({ mediaRequestId });
    const intents = await reviewStore.listIntents({ mediaRequestId });
    const activeRun = await activePreparation(mediaRequestId);
    return {
      items: rows.map(projectExternalRequestReviewItem),
      intents,
      ...(collectionReviewService ? { collection: null,
        canStartCollection: !activeRun && intents.length === 0 && ['playlist', 'artist'].includes(normalizeExternalMediaSource(request.sourceUrl)?.resourceType) } : {}),
      preparation: buildExternalRequestPreparationState({ items: rows, activeRun }),
    };
  }

  async function searchReleases({ mediaRequestId, artistName, releaseTitle }) {
    await loadRequest(mediaRequestId);
    for (const value of [artistName, releaseTitle]) {
      if (typeof value !== 'string' || !value.trim() || value.length > 500) {
        throw createApiError(400, 'validation_error', 'Artist and release title must be non-empty text of at most 500 characters');
      }
    }
    const search = metadataSearchService ?? createMetadataSearchService();
    const result = await search.searchReleasesByArtistAndTitle({ artistName, releaseTitle, limit: 20 });
    return { releases: result.results.map(({ id, title, artistName: artist, releaseDate, country, trackCount }) => ({
      id, title, artistName: artist, releaseDate, country, trackCount,
    })) };
  }

  async function audit({ actorUserId, mediaRequestId, eventType, summary, details, requestMetadata, queryable }) {
    await recordAuditEventFn({
      actorType: 'app_user', actorUserId, entityType: 'media_request', entityId: mediaRequestId,
      eventType, summary, details,
      ipAddress: requestMetadata?.ipAddress ?? null, userAgent: requestMetadata?.userAgent ?? null,
    }, queryable);
  }

  async function approveRelease({ mediaRequestId, providerIngestRequestId, metadataReleaseId, expectedRevision, actorUserId, requestMetadata = null }) {
    mediaRequestId = uuid(mediaRequestId, 'mediaRequestId');
    providerIngestRequestId = uuid(providerIngestRequestId, 'providerIngestRequestId');
    metadataReleaseId = uuid(metadataReleaseId, 'metadataReleaseId');
    return withTransaction(async (queryable) => {
      await assertMaintenanceWriteAllowed({ queryable });
      await reviewStore.lockRequest({ mediaRequestId, queryable });
      const request = await loadRequest(mediaRequestId, queryable);
      await assertEligibleTarget(request, queryable);
      const collectionContext = await collectionReviewService?.prepareInclusion({ mediaRequestId, providerIngestRequestId, expectedRevision, request, queryable });
      const row = collectionContext ? collectionContext.item.providerRow
        : (await providerIngestRequestStore.listProviderIngestRequests({ mediaRequestId, queryable }))
          .find((item) => item.id === providerIngestRequestId);
      if (!row) throw createApiError(404, 'provider_ingest_request_not_found', 'The provider item does not belong to this request');
      const item = projectExternalRequestReviewItem(row);
      if (!item.reviewable) throw createApiError(409, 'external_request_item_not_reviewable', 'Only completed provider albums with artist and title evidence can be approved');
      const intents = await reviewStore.listIntents({ mediaRequestId, queryable });
      const existing = intents.find((intent) => intent.providerKey === item.providerKey || intent.metadataReleaseId === metadataReleaseId);
      if (existing) {
        if ((!collectionContext && existing.providerKey !== item.providerKey) || existing.metadataReleaseId !== metadataReleaseId
          || existing.requestedForUserId !== request.requestedForUser?.id) throw conflict();
        await collectionReviewService?.recordInclusion({ context: collectionContext, intent: existing, actorUserId, requestMetadata, queryable });
        return { accepted: true, reusedExistingIntent: true, intent: existing,
          run: existing.operationRunId ? { id: existing.operationRunId, status: existing.status } : null };
      }
      const release = await reviewStore.getRelease({ metadataReleaseId, queryable });
      if (!release) throw createApiError(404, 'metadata_release_not_found', 'The selected local metadata release could not be found');
      const { sourceProvider, sourceIdentifier, title, artistName, releaseDate, trackCount, fetchedAt } = item;
      const intent = await reviewStore.createIntent({
        mediaRequestId, metadataReleaseId, requestedForUserId: request.requestedForUser.id,
        providerKey: item.providerKey, approvedByUserId: actorUserId, queryable,
        providerEvidence: { sourceProvider, sourceIdentifier, title, artistName, releaseDate, trackCount, fetchedAt },
      });
      const run = await discoveryRunStore.createOperationRun({ intentId: intent.id, mediaRequestId, triggeredByUserId: actorUserId, triggerSource: 'operator_review', queryable });
      const savedIntent = await reviewStore.setIntentRun({ intentId: intent.id, operationRunId: run.id, queryable });
      await collectionReviewService?.recordInclusion({ context: collectionContext, intent: savedIntent, actorUserId, requestMetadata, queryable });
      await audit({ actorUserId, mediaRequestId, eventType: 'external_request_release_approved',
        summary: 'Provider album approved for target-owned release discovery',
        details: { intentId: intent.id, metadataReleaseId, requestedForUserId: intent.requestedForUserId, providerKey: item.providerKey, operationRunId: run.id },
        requestMetadata, queryable });
      return { accepted: true, reusedExistingIntent: false, intent: savedIntent, run };
    });
  }

  async function recoverPreparation({ mediaRequestId, actorUserId, requestMetadata = null }) {
    mediaRequestId = uuid(mediaRequestId, 'mediaRequestId');
    return withTransaction(async (queryable) => {
      await assertMaintenanceWriteAllowed({ queryable });
      await reviewStore.lockRequest({ mediaRequestId, queryable });
      const request = await loadRequest(mediaRequestId, queryable);
      await assertEligibleTarget(request, queryable);
      await collectionReviewService?.assertPreparationRecovery({ mediaRequestId, request, queryable });
      const activeRun = await activePreparation(mediaRequestId, queryable);
      if (activeRun) return { accepted: true, reusedExistingRun: true, run: activeRun };
      const items = await providerIngestRequestStore.listProviderIngestRequests({ mediaRequestId, queryable });
      const { action } = buildExternalRequestPreparationState({ items, activeRun: null });
      if (!action) throw createApiError(409, 'external_request_preparation_complete', 'No pending or failed provider work needs recovery');
      const normalizedSource = normalizeExternalMediaSource(request.sourceUrl);
      let result;
      if (action === 'plan') {
        result = await externalIntakeService.queueExternalMediaRequestPlanning({
          mediaRequestId, normalizedSource, triggeredByUserId: actorUserId,
          triggerSource: 'operator_recovery', requestMetadata, queryable,
        });
      } else {
        await reviewStore.retryFailedProviderItems({ mediaRequestId, queryable });
        const run = await executionRunStore.createOperationRun({
          mediaRequestId, canonicalUrl: normalizedSource.canonicalUrl, resourceType: normalizedSource.resourceType,
          sourceIdentifier: normalizedSource.sourceIdentifier, sourceProvider: normalizedSource.provider,
          triggeredByUserId: actorUserId, triggerSource: 'operator_recovery', queryable,
        });
        result = { accepted: true, reusedExistingRun: false, run };
      }
      await audit({ actorUserId, mediaRequestId, eventType: 'external_request_preparation_recovered',
        summary: 'Provider preparation recovery queued', details: { action, operationRunId: result.run.id }, requestMetadata, queryable });
      return result;
    });
  }

  return { buildReview, searchReleases, approveRelease, recoverPreparation };
}
