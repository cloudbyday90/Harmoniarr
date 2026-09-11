/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { seedMetadataReleaseFixture } from '../integration/metadata-fixtures.js';
import { createRequestRecoveryServices } from './request-recovery-services.js';
import { addRequestRecoveryEvent, createRequestRecoveryUsers } from './request-recovery-store.js';

function requireFixture(condition) {
  if (!condition) throw new Error('Request recovery fixture did not reach its required state');
}

export async function completeRequestRecoverySelection({ services, fixture, mediaRequestId }) {
  let intent;
  let run;
  for (const albumId of services.albumIds.slice(0, 2)) {
    const review = await services.reviewService.buildReview({ mediaRequestId });
    const item = review.items.find((entry) => entry.sourceIdentifier === albumId);
    requireFixture(item?.reviewable);
    const approval = await services.reviewService.approveRelease({
      mediaRequestId, providerIngestRequestId: item.id, metadataReleaseId: fixture.metadataReleaseId,
      expectedRevision: review.collection.revision, actorUserId: fixture.adminUserId,
    });
    if (intent) requireFixture(approval.reusedExistingIntent && approval.intent.id === intent.id && approval.run.id === run.id);
    intent = approval.intent;
    run = approval.run;
    const includedReview = await services.reviewService.buildReview({ mediaRequestId });
    const repeated = await services.reviewService.approveRelease({
      mediaRequestId, providerIngestRequestId: item.id, metadataReleaseId: fixture.metadataReleaseId,
      expectedRevision: includedReview.collection.revision, actorUserId: fixture.adminUserId,
    });
    requireFixture(repeated.reusedExistingIntent && repeated.intent.id === intent.id && repeated.run.id === run.id);
    const repeatedReview = await services.reviewService.buildReview({ mediaRequestId });
    requireFixture(repeatedReview.collection.revision === includedReview.collection.revision);
  }
  const review = await services.reviewService.buildReview({ mediaRequestId });
  const excluded = review.items.find((item) => item.sourceIdentifier === services.albumIds[2]);
  requireFixture(excluded?.decision === 'pending');
  const exclusion = await services.collectionReviewService.excludeItem({
    mediaRequestId, collectionItemId: excluded.collectionItemId,
    reason: 'This alternate album is outside the reviewed selection.',
    expectedRevision: review.collection.revision, actorUserId: fixture.adminUserId,
  });
  const finalized = await services.collectionReviewService.finalizeCollection({
    mediaRequestId, expectedRevision: exclusion.collection.revision, actorUserId: fixture.adminUserId,
  });
  requireFixture(finalized.collection.status === 'reviewed');
  return { intent, run, revision: finalized.collection.revision };
}

export async function seedRequestRecoveryFixture({ getPoolFn }) {
  const pool = getPoolFn();
  const fixture = { schemaVersion: 1, ...await createRequestRecoveryUsers({ queryable: pool }) };
  Object.assign(fixture, await seedMetadataReleaseFixture({
    queryable: pool, artistName: 'Recovery fixture artist', releaseTitle: 'Recovery fixture release',
  }));
  const services = createRequestRecoveryServices({ getPoolFn });
  const reviewedRequest = await services.mediaRequestStore.createMediaRequest({
    requestedByUserId: fixture.adminUserId, requestedForUserId: fixture.recipientUserIds[0],
    requestKind: 'external_url', requestState: 'needs_fetch', sourceUrl: services.source.canonicalUrl,
    sourceProvider: services.source.provider, normalizedQuery: services.source.canonicalUrl,
    evidence: { fixture: 'backup_restore_continuity' }, fanOutChildCount: 1,
  });
  const [pendingRequest] = await services.mediaRequestStore.createFanOutChildRequests({
    parentRequest: reviewedRequest, targetUserIds: [fixture.recipientUserIds[1]],
  });
  fixture.reviewedRequestId = reviewedRequest.id;
  fixture.pendingRequestId = pendingRequest.id;
  for (const mediaRequestId of [fixture.reviewedRequestId, fixture.pendingRequestId]) {
    await addRequestRecoveryEvent({ queryable: pool, mediaRequestId, actorUserId: fixture.adminUserId });
  }

  let prepared = await services.collectionReviewService.startCollection({
    mediaRequestId: fixture.reviewedRequestId, actorUserId: fixture.adminUserId,
  });
  for (let batch = 0; batch < 3; batch += 1) {
    const result = await services.collectionIntakeService.executeCollection({ mediaRequestId: fixture.reviewedRequestId, operationRunId: prepared.run.id });
    requireFixture(result.failedCount === 0 && result.executedCount > 0);
    await services.completePreparationRun({ runId: prepared.run.id, mediaRequestId: fixture.reviewedRequestId });
    if (batch < 2) prepared = await services.reviewService.recoverPreparation({ mediaRequestId: fixture.reviewedRequestId, actorUserId: fixture.adminUserId });
    else requireFixture(result.collection.status === 'ready');
  }
  const selected = await completeRequestRecoverySelection({ services, fixture, mediaRequestId: fixture.reviewedRequestId });
  fixture.reviewedIntentId = selected.intent.id;
  fixture.discoveryRunId = selected.run.id;
  fixture.reviewedRevision = selected.revision;

  const started = await services.collectionReviewService.startCollection({ mediaRequestId: fixture.pendingRequestId, actorUserId: fixture.adminUserId });
  const firstPage = await services.collectionIntakeService.executeCollection({ mediaRequestId: fixture.pendingRequestId, operationRunId: started.run.id });
  requireFixture(firstPage.executedCount === 1 && firstPage.failedCount === 0 && firstPage.collection.status === 'preparing');
  await services.completePreparationRun({ runId: started.run.id, mediaRequestId: fixture.pendingRequestId });
  const recovery = await services.reviewService.recoverPreparation({ mediaRequestId: fixture.pendingRequestId, actorUserId: fixture.adminUserId });
  fixture.pendingRecoveryRunId = recovery.run.id;
  return fixture;
}
