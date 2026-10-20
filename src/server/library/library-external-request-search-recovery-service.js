/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { lockAppUserEligibility } from '../app-user-eligibility-lock-store.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { buildMediaRequestTargetEligibility } from '../media-request-target-eligibility.js';
import { canRecoverExternalSearchRun, getExternalSearchRecoveryMessage } from '../../shared/external-request-search-recovery-policy.js';
import { createLibraryExternalRequestReviewAccessService, normalizeExternalReviewId as uuid } from './library-external-request-review-access-service.js';
import { createLibraryExternalRequestSearchRecoveryStore } from './library-external-request-search-recovery-store.js';

function conflict() {
  return createApiError(409, 'external_request_search_recovery_conflict', 'This approved search changed. Refresh the review before requesting a new search.');
}

export function createLibraryExternalRequestSearchRecoveryService({ reviewStore, mediaRequestStore,
  discoveryRunStore, getAppUserById, assertMaintenanceWriteAllowed,
  store = createLibraryExternalRequestSearchRecoveryStore(),
  lockEligibility = lockAppUserEligibility, withTransaction = createDatabaseTransactionRunner(),
  recordAuditEventFn = recordAuditEvent } = {}) {
  const access = createLibraryExternalRequestReviewAccessService({ mediaRequestStore, getAppUserById });

  async function projectRecovery({ review, request }) {
    if (!review.intents?.some(intent => getExternalSearchRecoveryMessage(intent.searchFailureCode))) return review;
    const target = request.requestedForUser?.id ? await getAppUserById({ userId: request.requestedForUser.id }) : null;
    const eligible = buildMediaRequestTargetEligibility(target).eligible;
    return { ...review, intents: review.intents.map(intent => {
      const message = getExternalSearchRecoveryMessage(intent.searchFailureCode);
      if (!message || intent.status !== 'failed') return intent;
      return { ...intent, searchRecovery: { message, expectedOperationRunId: intent.operationRunId,
        canSearchAgain: eligible && request.requestedForUser?.id === intent.requestedForUserId } };
    }) };
  }

  async function searchAgain({ mediaRequestId, intentId, expectedOperationRunId, actorUserId, requestMetadata = null }) {
    mediaRequestId = uuid(mediaRequestId, 'mediaRequestId'); intentId = uuid(intentId, 'intentId');
    expectedOperationRunId = uuid(expectedOperationRunId, 'expectedOperationRunId');
    const preflight = await access.loadRequest(mediaRequestId);
    const recipientId = preflight.requestedForUser?.id;
    if (!recipientId) throw conflict();
    return withTransaction(async queryable => {
      await assertMaintenanceWriteAllowed({ queryable });
      await lockEligibility({ userIds: [recipientId], queryable });
      await reviewStore.lockRequest({ mediaRequestId, queryable });
      const request = await access.loadRequest(mediaRequestId, queryable);
      if (request.requestedForUser?.id !== recipientId) throw conflict();
      await access.assertEligibleTarget(request, queryable);
      if (!await store.lockIntent({ mediaRequestId, intentId, queryable })) {
        throw createApiError(404, 'external_request_intent_not_found', 'The approved release could not be found for this request');
      }
      const intent = await reviewStore.getIntentById({ intentId, queryable });
      if (!intent || intent.requestedForUserId !== recipientId || !intent.operationRunId) throw conflict();
      const current = await store.lockRun({ operationRunId: intent.operationRunId, queryable });
      if (!current || current.operationType !== 'library_external_request_discovery'
        || current.summary?.intentId !== intentId || current.summary?.mediaRequestId !== mediaRequestId) throw conflict();
      const result = (runId, reusedExistingRun) => ({ searchRecovery: { outcome: 'queued', intentId, mediaRequestId,
        previousOperationRunId: expectedOperationRunId, operationRunId: runId, reusedExistingRun } });
      if (current.id !== expectedOperationRunId) {
        if (current.summary.searchRecoveryOfRunId === expectedOperationRunId) return result(current.id, true);
        throw conflict();
      }
      if (!canRecoverExternalSearchRun(current) || await discoveryRunStore.getActiveRunByIntentId(intentId, queryable)) throw conflict();
      const run = await discoveryRunStore.createOperationRun({ intentId, mediaRequestId, triggeredByUserId: actorUserId,
        triggerSource: 'operator_search_recovery', searchRecoveryOfRunId: current.id, queryable });
      await reviewStore.setIntentRun({ intentId, operationRunId: run.id, queryable });
      if (!await store.supersedeRun({ operationRunId: current.id, queryable })) throw conflict();
      await recordAuditEventFn({ actorType: 'app_user', actorUserId, eventType: 'external_request_search_again_requested',
        entityType: 'media_request', entityId: mediaRequestId, summary: 'New search queued for an approved external release',
        details: { intentId, metadataReleaseId: intent.metadataReleaseId, requestedForUserId: recipientId,
          previousOperationRunId: current.id, operationRunId: run.id },
        ipAddress: requestMetadata?.ipAddress ?? null, userAgent: requestMetadata?.userAgent ?? null }, queryable);
      return result(run.id, false);
    });
  }
  return { projectRecovery, searchAgain };
}
