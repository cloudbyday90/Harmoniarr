/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isDeepStrictEqual } from 'node:util';
import { createOperatorTrackDeliveryProgressStore } from './operator-track-delivery-progress-store.js';
import { createOperatorTrackScopeVerificationService } from './operator-track-scope-verification-service.js';
import { fingerprintOperatorTrackFile } from './operator-track-file-evidence-service.js';
import { assertOperatorTrackMedia, refuseOperatorTrackFiles } from './operator-track-file-policy.js';
import { captureTrackDeliveryPlans, readTrackDeliveryProgress } from './operator-track-delivery-progress-policy.js';
import { createMediaInspectionService } from '../media/media-inspection-service.js';

export function createOperatorTrackDeliveryRecoveryService({ store = createOperatorTrackDeliveryProgressStore(),
  verifier = createOperatorTrackScopeVerificationService(), fingerprintTrackFile = fingerprintOperatorTrackFile,
  mediaInspectionService = createMediaInspectionService() } = {}) {
  async function resolveDelivered({ importCandidateId, files, queryable = null, selection = null }) {
    const candidate = await store.readCandidate({ importCandidateId, queryable });
    if (!Object.hasOwn(candidate?.normalizedPayload ?? {}, 'operatorTrackDeliveryProgress')) return new Map();
    if (candidate.status !== 'import_pending') throw refuseOperatorTrackFiles();
    selection ??= await verifier.assertCandidateCurrent(candidate, { queryable });
    const deliveries = readTrackDeliveryProgress(candidate, selection); const result = new Map();
    if (!isDeepStrictEqual(candidate.normalizedPayload.operatorTrackDeliveryProgress.plans, captureTrackDeliveryPlans(files))) throw refuseOperatorTrackFiles();
    for (const operation of deliveries) {
      const file = files.find(entry => entry.fileId === operation.fileId);
      if (!file || file.libraryTarget?.path !== operation.libraryPath || !isDeepStrictEqual(file.delivery, operation.delivery)) throw refuseOperatorTrackFiles();
      const before = await fingerprintTrackFile(operation.libraryPath, { libraryRoot: file.delivery.libraryRoot });
      if (!isDeepStrictEqual(before, operation.trackFileEvidence)) throw refuseOperatorTrackFiles();
      assertOperatorTrackMedia({ track: operation.verifiedTrack, releaseMbid: selection.releaseMbid,
        inspection: await mediaInspectionService.inspectSourceFile({ sourcePath: operation.libraryPath }) });
      if (!isDeepStrictEqual(before, await fingerprintTrackFile(operation.libraryPath, { libraryRoot: file.delivery.libraryRoot }))) throw refuseOperatorTrackFiles();
      result.set(operation.fileId, operation);
    }
    return result;
  }
  return { resolveDelivered };
}
