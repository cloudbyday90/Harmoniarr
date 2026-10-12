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

export function createOperatorTrackFulfillmentService({
  verifier = createOperatorTrackScopeVerificationService(), store = createOperatorTrackAcquisitionStore(),
} = {}) {
  async function persistFulfillment({ candidate, applyResult, queryable }) {
    const selection = await verifier.assertCandidateCurrent(candidate, { queryable });
    if (!selection) return null;
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
  return { persistFulfillment };
}
