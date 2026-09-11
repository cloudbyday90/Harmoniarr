/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { createAppUserService } from '../app-user-service.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { buildMediaRequestTargetEligibility } from '../media-request-target-eligibility.js';
import { createOperationRunCancellationError, isOperationRunCancellationError, isOperationRunPauseError, throwIfOperationRunCancellationRequested } from '../operation-run-cancellation.js';
import { buildProviderIngestPlan } from './external-media-source-parser.js';
import { createLibraryMediaRequestStore } from './library-media-request-store.js';
import { createLibraryExternalRequestCollectionIntakeStore } from './library-external-request-collection-intake-store.js';
import { buildCollectionWorkKey, collectionIntakeLimits, collectionProtocolError, isCollectionSource, requireProviderIdentifier } from './provider-collection-cursor-policy.js';
import { adaptProviderCollectionPage } from './provider-collection-page-adapter.js';
import { fetchProviderCollectionWork } from './provider-collection-fetch-service.js';

function stopped(operationRunId) {
  return createOperationRunCancellationError({ runId: operationRunId, message: 'Provider preparation stopped because the request or target is no longer eligible' });
}

function unavailableLeaf(row, error) {
  if (!['release', 'track'].includes(row.ingestTargetType) || !['spotify_not_found', 'apple_music_not_found'].includes(error?.code)) return null;
  return { response: { unavailable: true }, providerSnapshot: null, page: {
    containerPage: false, nextPageCursor: null, derivedRequests: [],
    items: [{ itemKey: `${row.sourceProvider}:${row.ingestTargetType === 'release' ? 'release' : 'unsupported'}:${row.sourceIdentifier}`,
      sourceProvider: row.sourceProvider, sourceIdentifier: row.sourceIdentifier, itemKind: 'unsupported', title: null,
      artistName: null, evidence: { reason: 'provider_item_unavailable' }, workKey: row.ingestKey }],
  } };
}

export function createLibraryExternalRequestCollectionIntakeService({
  collectionStore = createLibraryExternalRequestCollectionIntakeStore(),
  mediaRequestStore = createLibraryMediaRequestStore(),
  getAppUserById = createAppUserService().getAppUserById,
  withTransaction = createDatabaseTransactionRunner(),
  assertMaintenanceWriteAllowed = async () => {},
  isCancellationRequested = collectionStore.isCancellationRequested,
  resolveProviderClients = async () => ({}),
  getNow = () => new Date(),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  async function assertActive({ mediaRequestId, operationRunId, collection = null, queryable = null }) {
    await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId: operationRunId, queryable });
    await assertMaintenanceWriteAllowed({ queryable });
    const request = await mediaRequestStore.getMediaRequestById({ mediaRequestId, queryable });
    if (!request) throw createApiError(404, 'media_request_not_found', 'The music request was not found');
    const targetId = request.requestedForUser?.id;
    const user = await getAppUserById({ userId: targetId, queryable });
    if (request.requestKind !== 'external_url' || request.requestState !== 'needs_fetch'
      || !targetId || user?.id !== targetId || !buildMediaRequestTargetEligibility(user).eligible
      || (collection && collection.requestedForUserId !== targetId)) throw stopped(operationRunId);
    return request;
  }

  async function initializeCollection({ mediaRequestId, normalizedSource, operationRunId = null, triggeredByUserId = null, queryable = null, restart = false }) {
    if (!isCollectionSource(normalizedSource)) throw createApiError(409, 'external_collection_required', 'This provider source is not a supported collection');
    requireProviderIdentifier(normalizedSource.sourceIdentifier);
    if (normalizedSource.provider === 'apple_music' && !/^[a-z]{2}$/.test(normalizedSource.storefront ?? '')) throw collectionProtocolError();
    const initialize = async (client) => {
      await assertMaintenanceWriteAllowed({ queryable: client });
      await collectionStore.lockRequest({ mediaRequestId, queryable: client });
      const current = await collectionStore.getCollection({ mediaRequestId, queryable: client, lock: true });
      const request = await assertActive({ mediaRequestId, operationRunId, collection: restart ? null : current, queryable: client });
      if (current && !restart) return {
        mediaRequestId, collection: current, normalizedSource, plannedAt: getNow().toISOString(),
        providerIngestRequests: current.status === 'preparing' ? await collectionStore.listWork({ mediaRequestId, queryable: client }) : [],
      };
      if (await collectionStore.hasOtherPreparation({ mediaRequestId, operationRunId, queryable: client })) {
        throw createApiError(409, 'external_request_preparation_active', 'Provider preparation is already active');
      }
      if (!current && await collectionStore.hasApprovedIntents({ mediaRequestId, queryable: client })) {
        throw createApiError(409, 'external_collection_legacy_approvals', 'This collection already has approved albums. Create a separate request to capture a new selection.');
      }
      if (restart && (!current || current.status !== 'blocked' || await collectionStore.hasDecisions({ mediaRequestId, queryable: client }))) {
        throw createApiError(409, 'external_collection_restart_unavailable', 'Only a blocked collection without review decisions can be restarted');
      }
      const collection = await collectionStore.initialize({ mediaRequestId, requestedForUserId: request.requestedForUser.id, normalizedSource, queryable: client });
      const row = { ...buildProviderIngestPlan({ normalizedSource })[0], mediaRequestId };
      row.ingestKey = buildCollectionWorkKey(row);
      const work = await collectionStore.insertWork({ row, queryable: client });
      await recordAuditEventFn({ actorType: triggeredByUserId ? 'app_user' : 'system', actorUserId: triggeredByUserId,
        entityId: mediaRequestId, entityType: 'media_request', eventType: 'provider_collection_preparation_started',
        summary: restart ? 'Restarted provider collection preparation' : 'Started provider collection preparation',
        details: { operationRunId, sourceProvider: normalizedSource.provider, sourceIdentifier: normalizedSource.sourceIdentifier,
          requestedForUserId: request.requestedForUser.id, expansionPolicy: 'bounded', restart } }, client);
      return { mediaRequestId, collection, normalizedSource, plannedAt: getNow().toISOString(), providerIngestRequests: [work] };
    };
    return queryable ? initialize(queryable) : withTransaction(initialize);
  }

  async function persistPage({ mediaRequestId, operationRunId, row, page, response, providerSnapshot }) {
    return withTransaction(async (queryable) => {
      await assertMaintenanceWriteAllowed({ queryable });
      await collectionStore.lockRequest({ mediaRequestId, queryable });
      const collection = await collectionStore.getCollection({ mediaRequestId, queryable, lock: true });
      await assertActive({ mediaRequestId, operationRunId, collection, queryable });
      const current = await collectionStore.getWork({ id: row.id, queryable });
      if (current?.status === 'completed') return { collection, committed: false };
      if (!collection || collection.status !== 'preparing') throw stopped(operationRunId);
      if (current?.status !== 'planned' || current.ingestKey !== row.ingestKey) throw stopped(operationRunId);
      if (providerSnapshot && collection.providerSnapshot && providerSnapshot !== collection.providerSnapshot) throw collectionProtocolError('provider_collection_snapshot_changed');
      const completedPages = collection.pagesCompleted + (page.containerPage ? 1 : 0);
      if (completedPages > collectionIntakeLimits.pages || (completedPages === collectionIntakeLimits.pages && page.nextPageCursor !== null)) throw collectionProtocolError('provider_collection_page_limit');
      const keys = new Set(await collectionStore.listItemKeys({ mediaRequestId, queryable }));
      for (const item of page.items) keys.add(item.itemKey);
      if (keys.size > collectionIntakeLimits.items) throw collectionProtocolError('provider_collection_item_limit');
      const workByKey = new Map([[row.ingestKey, current]]);
      for (const derived of page.derivedRequests) {
        if (['playlist_page', 'artist'].includes(derived.ingestTargetType)
          && await collectionStore.getWorkByKey({ mediaRequestId, ingestKey: derived.ingestKey, queryable })) throw collectionProtocolError('provider_collection_cursor_cycle');
        workByKey.set(derived.ingestKey, await collectionStore.insertWork({ row: derived, queryable }));
      }
      for (const item of page.items) {
        const work = item.workKey ? workByKey.get(item.workKey) ?? await collectionStore.getWorkByKey({ mediaRequestId, ingestKey: item.workKey, queryable }) : null;
        await collectionStore.insertItem({ mediaRequestId, item, providerIngestRequestId: work?.id ?? null, queryable });
      }
      await collectionStore.completeWork({ id: row.id, nextPageCursor: page.nextPageCursor,
        evidence: { response, fetchedAt: getNow().toISOString() }, queryable });
      return { collection: await collectionStore.advanceCollection({ mediaRequestId, containerPage: page.containerPage, itemsSeen: page.itemsSeen, providerSnapshot, queryable }), committed: true };
    });
  }

  async function executeCollection({ mediaRequestId, operationRunId = null }) {
    let collection = await collectionStore.getCollection({ mediaRequestId });
    if (!collection) throw createApiError(404, 'external_collection_not_found', 'Collection preparation was not initialized');
    await assertActive({ mediaRequestId, operationRunId, collection });
    if (collection.status === 'blocked') throw createApiError(409, 'external_collection_blocked', 'Collection preparation needs operator review before restarting');
    if (collection.status !== 'preparing') return { mediaRequestId, collection, executedCount: 0, failedCount: 0, derivedIngestRequests: [] };
    const rows = await collectionStore.listWork({ mediaRequestId, limit: collectionIntakeLimits.batch });
    const clients = await resolveProviderClients();
    let executedCount = 0;
    let failedCount = 0;
    for (const row of rows) {
      const guard = () => assertActive({ mediaRequestId, operationRunId, collection });
      try {
        if (['playlist_page', 'artist'].includes(row.ingestTargetType) && collection.pagesCompleted >= collectionIntakeLimits.pages) throw collectionProtocolError('provider_collection_page_limit');
        let fetched;
        try {
          fetched = await fetchProviderCollectionWork({ row, collection, clients, assertActive: guard });
        } catch (error) {
          fetched = unavailableLeaf(row, error);
          if (!fetched) throw error;
        }
        const page = fetched.page ?? adaptProviderCollectionPage({ row, response: fetched.response, storefront: collection.storefront });
        const result = await persistPage({ mediaRequestId, operationRunId, row, page, ...fetched });
        collection = result.collection;
        if (result.committed) executedCount++;
      } catch (error) {
        if (isOperationRunCancellationError(error) || isOperationRunPauseError(error) || error?.code === 'media_request_not_found') throw error;
        await withTransaction(async (queryable) => {
          await assertMaintenanceWriteAllowed({ queryable });
          await collectionStore.lockRequest({ mediaRequestId, queryable });
          const current = await collectionStore.getCollection({ mediaRequestId, queryable, lock: true });
          await assertActive({ mediaRequestId, operationRunId, collection: current, queryable });
          if (current?.status !== 'preparing') throw stopped(operationRunId);
          await collectionStore.failWork({ id: row.id, mediaRequestId, queryable,
            errorCode: error.collectionBlocked ? error.code : 'provider_collection_work_failed',
            blockedReason: error.collectionBlocked ? error.code : null });
        });
        failedCount++;
        if (error.collectionBlocked) break;
      }
    }
    collection = await collectionStore.getCollection({ mediaRequestId });
    return { mediaRequestId, collection, executedCount, failedCount, derivedIngestRequests: [] };
  }

  return { executeCollection, getCollection: collectionStore.getCollection, initializeCollection };
}
