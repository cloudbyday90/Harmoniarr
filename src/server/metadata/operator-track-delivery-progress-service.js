/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isDeepStrictEqual } from 'node:util';
import { getPool } from '../database.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { isCurrentJobLeaseAcquisition, normalizeExpectedJobLease } from '../job-lease-policy.js';
import { createOperatorTrackDeliveryProgressStore } from './operator-track-delivery-progress-store.js';
import { createOperatorTrackScopeVerificationService } from './operator-track-scope-verification-service.js';
import { captureTrackDeliveryOperation, captureTrackDeliveryPlans, readTrackDeliveryProgress } from './operator-track-delivery-progress-policy.js';
import { assertOperatorTrackMedia, refuseOperatorTrackFiles } from './operator-track-file-policy.js';
import { fingerprintOperatorTrackFile } from './operator-track-file-evidence-service.js';
import { createMediaInspectionService } from '../media/media-inspection-service.js';
import { insertImportCandidateEvent } from '../import-candidates/import-candidate-repository.js';
import { createMaintenanceLockWriteGuardService } from '../recovery/maintenance-lock-write-guard-service.js';
import { createMaintenanceLockService } from '../recovery/maintenance-lock-service.js';

export function createOperatorTrackDeliveryProgressService({ getPoolFn = getPool,
  store = createOperatorTrackDeliveryProgressStore({ getPoolFn }), verifier = createOperatorTrackScopeVerificationService({ getPoolFn }),
  withTransaction = createDatabaseTransactionRunner({ getPoolFn }), fingerprintTrackFile = fingerprintOperatorTrackFile,
  mediaInspectionService = createMediaInspectionService(), insertEvent = insertImportCandidateEvent,
  assertMaintenance = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: createMaintenanceLockService({ getPoolFn }).listActiveMaintenanceLocks }).assertNoActiveWriteLocks,
} = {}) {
  async function assertDeliveryAuthority({ importCandidateId, applyPreview, operationRunId, expectedLease }) {
    const accepted = structuredClone(applyPreview);
    expectedLease = normalizeExpectedJobLease(expectedLease, { leaseKey: `import_candidate_apply:${operationRunId}` });
    if (!expectedLease) throw refuseOperatorTrackFiles();
    await withTransaction(async queryable => {
      const original = await store.readCandidate({ importCandidateId, queryable });
      const initial = await verifier.assertCandidateCurrent(original, { queryable });
      if (!initial?.sharedDelivery) throw refuseOperatorTrackFiles();
      const candidate = await store.lockContext({ candidate: original, operationRunId, expectedLease, queryable });
      const current = await verifier.assertCandidateCurrent(candidate, { queryable, applyPreview: accepted });
      if (candidate.status !== 'import_pending' || !isDeepStrictEqual(initial.participants, current.participants)) throw refuseOperatorTrackFiles();
      await assertMaintenance({ queryable });
      const { run, lease, now } = await store.readAuthority({ operationRunId, expectedLease, queryable });
      if (run?.operation_type !== 'import_candidate_apply' || run.status !== 'running' || run.cancel_requested_at || run.cancelled_at
        || (Array.isArray(run.summary?.importCandidateIds) && !run.summary.importCandidateIds.includes(importCandidateId))
        || !isCurrentJobLeaseAcquisition(lease, expectedLease, { now })) throw refuseOperatorTrackFiles();
    });
  }
  async function recordDelivery({ importCandidateId, operation, applyPreview, operationRunId, expectedLease }) {
    const accepted = structuredClone({ operation: captureTrackDeliveryOperation(operation), applyPreview });
    expectedLease = normalizeExpectedJobLease(expectedLease, { leaseKey: `import_candidate_apply:${operationRunId}` });
    if (!expectedLease) throw refuseOperatorTrackFiles();
    return withTransaction(async queryable => {
      const original = await store.readCandidate({ importCandidateId, queryable });
      const initial = await verifier.assertCandidateCurrent(original, { queryable });
      if (!initial?.sharedDelivery) throw refuseOperatorTrackFiles();
      const candidate = await store.lockContext({ candidate: original, operationRunId, expectedLease, queryable });
      const selection = await verifier.assertCandidateCurrent(candidate, { queryable, applyPreview: accepted.applyPreview });
      if (!isDeepStrictEqual(initial.participants, selection.participants)) throw refuseOperatorTrackFiles();
      const assertCurrent = async () => {
        await assertMaintenance({ queryable });
        const { run, lease, now } = await store.readAuthority({ operationRunId, expectedLease, queryable });
        if (run?.operation_type !== 'import_candidate_apply' || run.status !== 'running' || run.cancel_requested_at || run.cancelled_at
          || (Array.isArray(run.summary?.importCandidateIds) && !run.summary.importCandidateIds.includes(importCandidateId))
          || !isCurrentJobLeaseAcquisition(lease, expectedLease, { now })) throw refuseOperatorTrackFiles();
        await verifier.assertCandidateCurrent(candidate, { queryable, applyPreview: accepted.applyPreview });
      };
      await assertCurrent();
      const files = readTrackDeliveryProgress(candidate, selection);
      const plans = captureTrackDeliveryPlans(accepted.applyPreview.files);
      if (files.length && !isDeepStrictEqual(candidate.normalizedPayload.operatorTrackDeliveryProgress.plans, plans)) throw refuseOperatorTrackFiles();
      const file = accepted.operation;
      readTrackDeliveryProgress({ normalizedPayload: { operatorTrackDeliveryProgress: { version: 1, participants: selection.participants, plans, files: [file] } } }, selection);
      const planned = accepted.applyPreview.files.find(entry => entry.fileId === file.fileId);
      if (planned?.libraryTarget?.path !== file.libraryPath || !isDeepStrictEqual(planned?.delivery, file.delivery)) throw refuseOperatorTrackFiles();
      if (!isDeepStrictEqual(file.trackFileEvidence, await fingerprintTrackFile(file.libraryPath, { libraryRoot: file.delivery.libraryRoot }))) throw refuseOperatorTrackFiles();
      assertOperatorTrackMedia({ track: file.verifiedTrack, releaseMbid: selection.releaseMbid,
        inspection: await mediaInspectionService.inspectSourceFile({ sourcePath: file.libraryPath }) });
      const existing = files.find(entry => entry.fileId === file.fileId);
      if (existing && !isDeepStrictEqual(existing, file)) throw refuseOperatorTrackFiles();
      if (!existing) {
        files.push(file); files.sort((a, b) => a.fileId.localeCompare(b.fileId));
        if (!await store.saveProgress({ importCandidateId, progress: { version: 1, participants: selection.participants, plans, files }, queryable })) throw refuseOperatorTrackFiles();
        await insertEvent({ importCandidateId, eventType: 'operator_track_delivery_verified', previousStatus: 'import_pending', newStatus: 'import_pending',
          details: { ownerId: file.delivery.ownerId, fileId: file.fileId, operationRunId } }, queryable);
      }
      await assertCurrent();
      if (!isDeepStrictEqual(file.trackFileEvidence, await fingerprintTrackFile(file.libraryPath, { libraryRoot: file.delivery.libraryRoot }))) throw refuseOperatorTrackFiles();
      return file;
    });
  }
  return { recordDelivery, assertDeliveryAuthority };
}
