/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { completeRequestRecoverySelection } from './request-recovery-fixture.js';
import { createRequestRecoveryServices } from './request-recovery-services.js';
import { readRequestRecoverySnapshot, verifyRequestRecoveryConstraints } from './request-recovery-store.js';

function requireContinuity(condition, message) {
  if (!condition) throw new Error(message);
}

function requireSame(actual, expected, message) {
  requireContinuity(isDeepStrictEqual(actual, expected), message);
}

async function requireRejection(work, code) {
  try { await work(); } catch (error) {
    requireContinuity(error?.code === code, 'Restored review rejected an operation for an unexpected reason');
    return;
  }
  throw new Error('Restored review accepted an invalid operation');
}

function reviewedLedger(snapshot, fixture) {
  const id = fixture.reviewedRequestId;
  return {
    request: snapshot.requests.filter((row) => row.id === id),
    events: snapshot.requestEvents.filter((row) => row.media_request_id === id),
    collections: snapshot.collections.filter((row) => row.media_request_id === id),
    items: snapshot.items.filter((row) => row.media_request_id === id),
    intents: snapshot.intents.filter((row) => row.media_request_id === id),
    work: snapshot.work.filter((row) => row.media_request_id === id),
    runs: snapshot.runs.filter((row) => row.summary.mediaRequestId === id),
    audits: snapshot.audits.filter((row) => row.entity_id === id),
  };
}

export async function captureRequestRecoverySnapshot({ queryable, fixture }) {
  return readRequestRecoverySnapshot({ queryable, fixture });
}

export async function verifyRestoredRequestRecovery({ getPoolFn, fixture, expectedSnapshot }) {
  const pool = getPoolFn();
  const capture = () => captureRequestRecoverySnapshot({ queryable: pool, fixture });
  const restored = await capture();
  requireSame(restored, expectedSnapshot, 'Restored request ledger differs from the backup source');
  requireContinuity(restored.requests.length === 2 && restored.collections.length === 2
    && restored.intents.length === 1 && restored.items.length === 5 && restored.work.length === 9
    && restored.candidates.length === 0, 'Restored request fixture is incomplete');
  const parent = restored.requests.find((row) => row.id === fixture.reviewedRequestId);
  const child = restored.requests.find((row) => row.id === fixture.pendingRequestId);
  requireContinuity(parent.requested_by_user_id === fixture.adminUserId && child.requested_by_user_id === fixture.adminUserId
    && parent.requested_for_user_id === fixture.recipientUserIds[0] && child.requested_for_user_id === fixture.recipientUserIds[1]
    && child.fan_out_parent_id === parent.id && parent.fan_out_child_count === 1, 'Restored request family ownership is invalid');
  requireContinuity(restored.intents[0].requested_for_user_id === fixture.recipientUserIds[0]
    && restored.intents[0].operation_run_id === fixture.discoveryRunId, 'Restored release intent lost its target or operation');
  await verifyRequestRecoveryConstraints({ queryable: pool, fixture });

  const services = createRequestRecoveryServices({ getPoolFn, allowFirstPage: false });
  const reviewedBefore = reviewedLedger(restored, fixture);
  const initialized = await services.collectionIntakeService.initializeCollection({ mediaRequestId: fixture.reviewedRequestId, normalizedSource: services.source });
  requireContinuity(initialized.collection.status === 'reviewed' && initialized.providerIngestRequests.length === 0, 'Reviewed collection was reinitialized');
  const noWork = await services.collectionIntakeService.executeCollection({ mediaRequestId: fixture.reviewedRequestId });
  requireContinuity(noWork.executedCount === 0, 'Reviewed collection unexpectedly scheduled provider work');
  await services.collectionReviewService.finalizeCollection({
    mediaRequestId: fixture.reviewedRequestId, expectedRevision: fixture.reviewedRevision, actorUserId: fixture.adminUserId,
  });
  await requireRejection(() => services.collectionReviewService.finalizeCollection({
    mediaRequestId: fixture.reviewedRequestId, expectedRevision: fixture.reviewedRevision - 1, actorUserId: fixture.adminUserId,
  }), 'external_collection_stale_review');
  await requireRejection(() => services.reviewService.recoverPreparation({
    mediaRequestId: fixture.reviewedRequestId, actorUserId: fixture.adminUserId,
  }), 'external_collection_review_conflict');
  const excluded = restored.items.find((row) => row.media_request_id === fixture.reviewedRequestId && row.decision === 'excluded');
  await requireRejection(() => services.collectionReviewService.excludeItem({
    mediaRequestId: fixture.reviewedRequestId, collectionItemId: excluded.id, reason: 'Attempted overwrite',
    expectedRevision: fixture.reviewedRevision, actorUserId: fixture.adminUserId,
  }), 'external_collection_not_ready');
  requireSame(reviewedLedger(await capture(), fixture), reviewedBefore, 'Restored review decisions changed during replay');

  const recoveryInput = { mediaRequestId: fixture.pendingRequestId, actorUserId: fixture.adminUserId };
  let recovered = await services.reviewService.recoverPreparation(recoveryInput);
  const duplicateRecovery = await services.reviewService.recoverPreparation(recoveryInput);
  requireContinuity(recovered.reusedExistingRun && duplicateRecovery.reusedExistingRun
    && recovered.run.id === fixture.pendingRecoveryRunId && duplicateRecovery.run.id === recovered.run.id, 'Restored queued preparation was duplicated');
  requireSame(await capture(), restored, 'Recovering an existing queued run changed the restored ledger');
  let resumedWorkCount = 0;
  for (let batch = 0; batch < 2; batch += 1) {
    const result = await services.collectionIntakeService.executeCollection({ mediaRequestId: fixture.pendingRequestId, operationRunId: recovered.run.id });
    requireContinuity(result.failedCount === 0 && result.executedCount > 0, 'Restored provider continuation could not complete');
    resumedWorkCount += result.executedCount;
    await services.completePreparationRun({ runId: recovered.run.id, mediaRequestId: fixture.pendingRequestId });
    if (batch === 0) {
      requireContinuity(result.collection.status === 'preparing', 'Preparation skipped its explicit continuation boundary');
      recovered = await services.reviewService.recoverPreparation(recoveryInput);
    } else requireContinuity(result.collection.status === 'ready', 'Restored preparation did not become reviewable');
  }
  requireSame(services.calls.pageOffsets, [2], 'Recovery replayed a committed provider page');
  requireSame([...services.calls.albumIds].sort(), [...services.albumIds].sort(), 'Recovery duplicated or omitted album preparation');
  const resumed = await capture();
  for (const completed of restored.work.filter((row) => row.status === 'completed')) {
    requireSame(resumed.work.find((row) => row.id === completed.id), completed, 'Recovery modified completed provider evidence');
  }
  const pendingReview = await services.reviewService.buildReview({ mediaRequestId: fixture.pendingRequestId });
  const otherRequestItem = restored.items.find((row) => row.media_request_id === fixture.reviewedRequestId && row.decision === 'included');
  await requireRejection(() => services.reviewService.approveRelease({
    mediaRequestId: fixture.pendingRequestId, providerIngestRequestId: otherRequestItem.provider_ingest_request_id,
    metadataReleaseId: fixture.metadataReleaseId, expectedRevision: pendingReview.collection.revision,
    actorUserId: fixture.adminUserId,
  }), 'external_collection_review_conflict');
  const selected = await completeRequestRecoverySelection({ services, fixture, mediaRequestId: fixture.pendingRequestId });
  requireContinuity(selected.intent.id !== fixture.reviewedIntentId && selected.run.id !== fixture.discoveryRunId
    && selected.intent.requestedForUserId === fixture.recipientUserIds[1], 'Restored recipients incorrectly shared a release intent');
  const finalized = await capture();
  requireSame(reviewedLedger(finalized, fixture), reviewedBefore, 'Resuming another recipient changed the reviewed selection');
  requireContinuity(finalized.intents.length === 2 && finalized.collections.every((row) => row.status === 'reviewed')
    && finalized.candidates.length === 0, 'Restored selection has unexpected acquisition state');
  const callsBeforeReplay = structuredClone(services.calls);
  const replay = await services.collectionIntakeService.executeCollection({ mediaRequestId: fixture.pendingRequestId });
  await services.collectionReviewService.finalizeCollection({
    mediaRequestId: fixture.pendingRequestId, expectedRevision: selected.revision, actorUserId: fixture.adminUserId,
  });
  requireContinuity(replay.executedCount === 0, 'Finalized collection unexpectedly resumed provider work');
  requireSame(services.calls, callsBeforeReplay, 'Finalized collection contacted a fixture provider again');
  requireSame(await capture(), finalized, 'Finalized collection replay duplicated durable work');

  return {
    schemaVersion: 1,
    restoredRequestCount: restored.requests.length,
    restoredCollectionCount: restored.collections.length,
    restoredDecisionCount: restored.items.filter((row) => row.decision !== 'pending').length,
    restoredProviderWorkCount: restored.work.length,
    restoredIntentCount: restored.intents.length,
    restoredOperationRunCount: restored.runs.length,
    restoredAuditEventCount: restored.audits.length,
    ledgerPreserved: true, ownershipPreserved: true, queuedRecoveryReused: true,
    continuationResumed: true, completedWorkPreserved: true, reviewedDecisionsPreserved: true,
    duplicateConstraintsVerified: true, retainedRunProtected: true, replayIdempotent: true,
    finalizedCollectionCount: finalized.collections.length, resumedWorkCount,
    providerNetworkRequests: 0, acquisitionOperationsExecuted: 0,
  };
}
