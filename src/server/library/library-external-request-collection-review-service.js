/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { normalizeExternalMediaSource } from './external-media-source-parser.js';
import { createLibraryExternalRequestCollectionReviewStore } from './library-external-request-collection-review-store.js';
import { createLibraryExternalRequestReviewAccessService, normalizeExternalReviewId as uuid } from './library-external-request-review-access-service.js';
import { assertCollectionReady, assertCollectionRevision, assertCollectionTarget, presentCollection } from './library-external-request-collection-review-policy.js';
import { projectExternalRequestReviewItem } from './library-external-request-review-evidence.js';

function conflict(message) {
  return createApiError(409, 'external_collection_review_conflict', message);
}

export function createLibraryExternalRequestCollectionReviewService({
  collectionReviewStore = createLibraryExternalRequestCollectionReviewStore(),
  collectionIntakeService, reviewStore, mediaRequestStore, getAppUserById,
  executionRunStore, planningRunStore,
  withTransaction = createDatabaseTransactionRunner(),
  assertMaintenanceWriteAllowed = async () => {}, recordAuditEventFn = recordAuditEvent,
}) {
  const access = createLibraryExternalRequestReviewAccessService({ mediaRequestStore, getAppUserById });
  async function audit({ mediaRequestId, actorUserId, requestMetadata, queryable, eventType, details }) {
    await recordAuditEventFn({ actorType: 'app_user', actorUserId, entityType: 'media_request', entityId: mediaRequestId,
      eventType, summary: 'External collection review updated', details,
      ipAddress: requestMetadata?.ipAddress ?? null, userAgent: requestMetadata?.userAgent ?? null }, queryable);
  }
  async function activeRun(mediaRequestId, queryable) {
    return await planningRunStore.getActiveRunByMediaRequestId(mediaRequestId, queryable)
      ?? await executionRunStore.getActiveRunByMediaRequestId(mediaRequestId, queryable);
  }
  async function lockedRequest(mediaRequestId, queryable) {
    await assertMaintenanceWriteAllowed({ queryable });
    await reviewStore.lockRequest({ mediaRequestId, queryable });
    const request = await access.loadRequest(mediaRequestId, queryable);
    await access.assertEligibleTarget(request, queryable);
    return request;
  }
  async function lockedCollection(mediaRequestId, request, queryable) {
    const collection = await collectionReviewStore.lockCollection({ mediaRequestId, queryable });
    if (collection) assertCollectionTarget(collection, request);
    return collection;
  }
  function requireCollection(collection) {
    if (!collection) throw createApiError(404, 'external_collection_not_found', 'Start collection preparation before reviewing its selection');
    return collection;
  }

  async function buildReview({ mediaRequestId, cursor = null, limit = 25 }) {
    mediaRequestId = uuid(mediaRequestId, 'mediaRequestId');
    if (cursor !== null) cursor = uuid(cursor, 'cursor');
    if (typeof limit === 'string' && /^\d+$/.test(limit)) limit = Number(limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw createApiError(400, 'validation_error', 'limit must be an integer between 1 and 50');
    return withTransaction(async (queryable) => {
      await reviewStore.lockRequest({ mediaRequestId, queryable });
      const request = await access.loadRequest(mediaRequestId, queryable);
      const collection = await collectionReviewStore.getCollection({ mediaRequestId, queryable });
      if (!collection) return null;
      const page = await collectionReviewStore.listItemsPage({ mediaRequestId, cursor, limit, queryable });
      const presented = presentCollection(collection, request);
      const running = await activeRun(mediaRequestId, queryable);
      if (running) presented.canRestart = false;
      const items = page.items.map((item) => {
        const provider = item.providerRow ? projectExternalRequestReviewItem(item.providerRow) : {};
        return { ...provider, id: provider.id ?? item.id, collectionItemId: item.id,
          sourceProvider: item.sourceProvider, sourceIdentifier: item.sourceIdentifier,
          title: provider.title ?? item.title?.slice(0, 500) ?? null,
          artistName: provider.artistName ?? item.artistName?.slice(0, 500) ?? null,
          decision: item.decision, exclusionReason: item.exclusionReason, itemKind: item.itemKind,
          releaseIntentId: item.releaseIntentId, status: provider.status ?? 'unsupported',
          reviewable: Boolean(provider.reviewable && item.decision === 'pending' && presented.targetMatches && collection.status === 'ready'),
        };
      });
      const intents = [];
      for (const intentId of new Set(items.map((item) => item.releaseIntentId).filter(Boolean))) {
        const intent = await reviewStore.getIntentById({ intentId, queryable });
        if (intent?.mediaRequestId === mediaRequestId) intents.push(intent);
      }
      const canRecover = presented.targetMatches && collection.status === 'preparing'
        && !running
        && await collectionReviewStore.hasUnfinishedWork({ mediaRequestId, queryable });
      return { items, intents, collection: presented, canStartCollection: false,
        preparation: { canRecover, action: canRecover ? 'execute' : null },
        pagination: { hasMore: page.hasMore, nextCursor: page.hasMore ? page.items.at(-1).id : null, limit },
      };
    });
  }

  async function startCollection({ mediaRequestId, actorUserId, restart = false, requestMetadata = null }) {
    mediaRequestId = uuid(mediaRequestId, 'mediaRequestId');
    if (typeof restart !== 'boolean') throw createApiError(400, 'validation_error', 'restart must be a boolean');
    return withTransaction(async (queryable) => {
      const request = await lockedRequest(mediaRequestId, queryable);
      const normalizedSource = normalizeExternalMediaSource(request.sourceUrl);
      if (!['playlist', 'artist'].includes(normalizedSource?.resourceType)) throw conflict('This source is not a supported collection');
      const collection = await lockedCollection(mediaRequestId, request, queryable);
      const run = await activeRun(mediaRequestId, queryable);
      if (run) {
        if (restart || !collection) throw conflict('Wait for active provider preparation before starting this collection');
        return { accepted: true, reusedExistingRun: true, run };
      }
      if (collection && (!restart || !presentCollection(collection, request).canRestart)) {
        throw conflict('Continue pending preparation or review the captured selection. Only blocked collections without decisions can restart.');
      }
      if (!collection && (await reviewStore.listIntents({ mediaRequestId, queryable })).length) {
        throw conflict('This legacy collection already has approved albums. Create a separate request to capture a new selection.');
      }
      await collectionIntakeService.initializeCollection({ mediaRequestId, normalizedSource, triggeredByUserId: actorUserId, restart, queryable });
      const queued = await executionRunStore.createOperationRun({ mediaRequestId,
        canonicalUrl: normalizedSource.canonicalUrl, resourceType: normalizedSource.resourceType,
        sourceIdentifier: normalizedSource.sourceIdentifier, sourceProvider: normalizedSource.provider,
        triggeredByUserId: actorUserId, triggerSource: 'operator_collection_review', queryable });
      await audit({ mediaRequestId, actorUserId, requestMetadata, queryable, eventType: 'external_collection_preparation_started', details: { restart, operationRunId: queued.id } });
      return { accepted: true, reusedExistingRun: false, run: queued };
    });
  }

  async function excludeItem({ mediaRequestId, collectionItemId, reason, expectedRevision, actorUserId, requestMetadata = null }) {
    mediaRequestId = uuid(mediaRequestId, 'mediaRequestId');
    collectionItemId = uuid(collectionItemId, 'collectionItemId');
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) throw createApiError(400, 'validation_error', 'An exclusion reason of 1 to 500 characters is required');
    return withTransaction(async (queryable) => {
      const request = await lockedRequest(mediaRequestId, queryable);
      const collection = requireCollection(await lockedCollection(mediaRequestId, request, queryable));
      assertCollectionRevision(collection, expectedRevision);
      assertCollectionReady(collection);
      const item = await collectionReviewStore.getItem({ mediaRequestId, collectionItemId, queryable });
      if (!item) throw createApiError(404, 'external_collection_item_not_found', 'The collection item does not belong to this request');
      if (item.decision === 'excluded' && item.exclusionReason === reason.trim()) return { accepted: true, collection: presentCollection(collection, request) };
      if (item.decision !== 'pending') throw conflict('An existing collection decision cannot be changed');
      const updated = await collectionReviewStore.recordDecision({ mediaRequestId, collectionItemId, decision: 'excluded', exclusionReason: reason.trim(), actorUserId, queryable });
      await audit({ mediaRequestId, actorUserId, requestMetadata, queryable, eventType: 'external_collection_item_excluded', details: { collectionItemId, reason: reason.trim(), revision: updated.revision } });
      return { accepted: true, collection: presentCollection(updated, request) };
    });
  }

  async function finalizeCollection({ mediaRequestId, expectedRevision, actorUserId, requestMetadata = null }) {
    mediaRequestId = uuid(mediaRequestId, 'mediaRequestId');
    return withTransaction(async (queryable) => {
      const request = await lockedRequest(mediaRequestId, queryable);
      const collection = requireCollection(await lockedCollection(mediaRequestId, request, queryable));
      assertCollectionRevision(collection, expectedRevision);
      if (collection.status === 'reviewed') return { accepted: true, collection: presentCollection(collection, request) };
      assertCollectionReady(collection);
      if (!presentCollection(collection, request).canFinalize || await collectionReviewStore.hasUnfinishedWork({ mediaRequestId, queryable })) {
        throw conflict('Every captured item needs a decision and at least one included album before review can be finalized');
      }
      const intentsById = new Map((await reviewStore.listIntents({ mediaRequestId, queryable })).map((intent) => [intent.id, intent]));
      for (const intentId of collection.includedIntentIds) {
        const intent = intentsById.get(intentId);
        if (intent?.mediaRequestId !== mediaRequestId || intent.requestedForUserId !== request.requestedForUser.id) throw conflict('Included albums must belong to the current request target');
      }
      const updated = await collectionReviewStore.finalize({ mediaRequestId, actorUserId, queryable });
      await audit({ mediaRequestId, actorUserId, requestMetadata, queryable, eventType: 'external_collection_review_finalized', details: { revision: updated.revision, includedCount: updated.includedCount, excludedCount: updated.excludedCount } });
      return { accepted: true, collection: presentCollection(updated, request) };
    });
  }

  async function prepareInclusion({ mediaRequestId, providerIngestRequestId, expectedRevision, request, queryable }) {
    const collection = await lockedCollection(mediaRequestId, request, queryable);
    if (!collection) return null;
    assertCollectionRevision(collection, expectedRevision);
    assertCollectionReady(collection);
    const item = await collectionReviewStore.getItem({ mediaRequestId, providerIngestRequestId, queryable });
    if (!item || item.itemKind !== 'release' || item.decision === 'excluded') throw conflict('Only a captured album without an exclusion can be included');
    return { collection, item };
  }
  async function recordInclusion({ context, intent, actorUserId, requestMetadata, queryable }) {
    if (!context) return;
    if (context.item.decision === 'included') {
      if (context.item.releaseIntentId !== intent.id) throw conflict('This album already has a different included release');
      return;
    }
    const mediaRequestId = context.collection.mediaRequestId;
    await collectionReviewStore.recordDecision({ mediaRequestId, collectionItemId: context.item.id, decision: 'included', releaseIntentId: intent.id, actorUserId, queryable });
    await audit({ mediaRequestId, actorUserId, requestMetadata, queryable, eventType: 'external_collection_item_included', details: { collectionItemId: context.item.id, intentId: intent.id } });
  }
  async function assertPreparationRecovery({ mediaRequestId, request, queryable }) {
    const collection = await lockedCollection(mediaRequestId, request, queryable);
    if (collection && collection.status !== 'preparing') throw conflict('This collection has no resumable preparation. Review its status before continuing.');
  }
  return { buildReview, startCollection, excludeItem, finalizeCollection, prepareInclusion, recordInclusion, assertPreparationRecovery };
}
