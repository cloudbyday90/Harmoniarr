/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isDeepStrictEqual } from 'node:util';
import { createOperatorTrackScopeVerificationService } from './operator-track-scope-verification-service.js';
import { createOperatorTrackAcquisitionStore } from './operator-track-acquisition-store.js';
import { refuseOperatorTrackFiles } from './operator-track-file-policy.js';
import { createOperatorTrackDeliveryPlanService } from './operator-track-delivery-plan-service.js';
import { createOperatorTrackDeliveryProgressStore } from './operator-track-delivery-progress-store.js';
import { fingerprintOperatorTrackFile } from './operator-track-file-evidence-service.js';
import { createOperatorTrackSourceLifecycleService } from './operator-track-source-lifecycle-service.js';
import { isCurrentJobLeaseAcquisition, normalizeExpectedJobLease } from '../job-lease-policy.js';

export function createOperatorTrackFulfillmentService({
  verifier = createOperatorTrackScopeVerificationService(), store = createOperatorTrackAcquisitionStore(),
  deliveryPlanService = createOperatorTrackDeliveryPlanService(),
  progressStore = createOperatorTrackDeliveryProgressStore(), fingerprintTrackFile = fingerprintOperatorTrackFile,
  sourceLifecycle = createOperatorTrackSourceLifecycleService(),
} = {}) {
  async function assertPublicationCurrent({ candidate, applyResult, queryable, applyContext = null }) {
    const selection = await verifier.assertCandidateCurrent(candidate, { queryable });
    if (!selection?.sharedDelivery) return;
    if (applyContext) {
      const expectedLease = normalizeExpectedJobLease(applyContext.expectedLease, { leaseKey: `import_candidate_apply:${applyContext.operationRunId}` });
      if (!expectedLease) throw refuseOperatorTrackFiles();
      const { run, lease, now } = await progressStore.readAuthority({ ...applyContext, expectedLease, queryable });
      if (run?.operation_type !== 'import_candidate_apply' || run.status !== 'running' || run.cancel_requested_at || run.cancelled_at
        || (Array.isArray(run.summary?.importCandidateIds) && !run.summary.importCandidateIds.includes(candidate.id))
        || !isCurrentJobLeaseAcquisition(lease, expectedLease, { now })) throw refuseOperatorTrackFiles();
    }
    await deliveryPlanService.assertPreviewCurrent({ selection, files: applyResult.fileOperations, queryable });
    for (const file of applyResult.fileOperations) if (!isDeepStrictEqual(file.trackFileEvidence,
      await fingerprintTrackFile(file.libraryPath, { libraryRoot: file.delivery?.libraryRoot }))) throw refuseOperatorTrackFiles();
  }
  async function persistFulfillment({ candidate, applyResult, queryable, applyContext = null }) {
    let selection = await verifier.assertCandidateCurrent(candidate, { queryable });
    if (!selection) return null;
    if (selection.sharedDelivery) {
      const expectedLease = applyContext ? normalizeExpectedJobLease(applyContext.expectedLease,
        { leaseKey: `import_candidate_apply:${applyContext.operationRunId}` }) : null;
      if (applyContext && !expectedLease) throw refuseOperatorTrackFiles();
      candidate = await progressStore.lockContext({ candidate, queryable, ...(applyContext ? { ...applyContext, expectedLease } : {}) });
      const current = await verifier.assertCandidateCurrent(candidate, { queryable });
      if (!isDeepStrictEqual(current.participants, selection.participants)) throw refuseOperatorTrackFiles();
      selection = current;
      const files = applyResult?.fileOperations;
      if (!isDeepStrictEqual(applyResult?.operatorTrackScope, selection.scope) || files?.length !== 2
        || new Set(files.map(file => file.fileId)).size !== 2) throw refuseOperatorTrackFiles();
      await deliveryPlanService.assertPreviewCurrent({ selection, files, queryable });
      await assertPublicationCurrent({ candidate, applyResult, queryable, applyContext });
      for (const file of files) {
        if (!isDeepStrictEqual(file.trackFileEvidence, await fingerprintTrackFile(file.libraryPath, { libraryRoot: file.delivery?.libraryRoot }))) throw refuseOperatorTrackFiles();
      }
      const receipts = selection.participants.map(participant => {
        const binding = selection.bindings.find(entry => entry.track.metadataTrackId === participant.scope.tracks[0].metadataTrackId);
        const file = files.find(entry => entry.fileId === binding?.fileId);
        if (!file || file.status !== 'applied' || !isDeepStrictEqual(file.verifiedTrack, binding.track)
          || !/^[a-f0-9]{64}$/u.test(file.trackFileEvidence?.sha256 ?? '') || !(file.trackFileEvidence.sizeBytes > 0)) throw refuseOperatorTrackFiles();
        return { version: 1, ownerId: participant.ownerId, sourceMediaRequestId: participant.mediaRequestId,
          wantedReleaseId: participant.wantedReleaseId, scope: participant.scope,
          files: [{ fileId: file.fileId, libraryPath: file.libraryPath, track: file.verifiedTrack, evidence: file.trackFileEvidence }] };
      });
      const receipt = structuredClone({ version: 2, receipts });
      await store.saveFulfillment({ importCandidateId: candidate.id, receipt, queryable });
      await sourceLifecycle.reconcileSources({ sources: receipts.map(entry => ({ ownerId: entry.ownerId, mediaRequestId: entry.sourceMediaRequestId,
        importCandidateId: candidate.id, scope: entry.scope, available: true })), queryable,
      assertCurrent: () => assertPublicationCurrent({ candidate, applyResult, queryable, applyContext }) });
      return receipt;
    }
    const files = applyResult?.fileOperations;
    const owner = candidate.normalizedPayload?.requestOwnership;
    if (!isDeepStrictEqual(applyResult?.operatorTrackScope, selection.scope) || files?.length !== 1
      || files[0].status !== 'applied' || files[0].fileId !== selection.bindings[0].fileId
      || !isDeepStrictEqual(files[0].verifiedTrack, selection.bindings[0].track) || !files[0].libraryPath
      || !/^[a-f0-9]{64}$/u.test(files[0].trackFileEvidence?.sha256 ?? '') || !(files[0].trackFileEvidence?.sizeBytes > 0)
      || !owner?.sourceRequestedForUserId || !owner?.sourceMediaRequestId) throw refuseOperatorTrackFiles();
    const receipt = { version: 1, ownerId: owner.sourceRequestedForUserId, sourceMediaRequestId: owner.sourceMediaRequestId,
      scope: structuredClone(selection.scope), files: [{ fileId: files[0].fileId, libraryPath: files[0].libraryPath,
        track: structuredClone(files[0].verifiedTrack), evidence: structuredClone(files[0].trackFileEvidence) }] };
    await store.saveFulfillment({ importCandidateId: candidate.id, receipt, queryable });
    return receipt;
  }
  return { persistFulfillment, assertPublicationCurrent };
}
