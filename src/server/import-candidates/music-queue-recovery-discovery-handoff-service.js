/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { lockAppUserEligibility } from '../app-user-eligibility-lock-store.js';
import { recordAuditEvent } from '../audit.js';
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';
import { lockLibraryDiscoveryRunCreation } from '../library/library-discovery-run-lock-store.js';
import { createAcquisitionQualityPolicyService } from '../acquisition/acquisition-quality-policy-service.js';
import { createImportCandidateExecutionRunStore } from './import-candidate-execution-run-store.js';
import { createMusicQueueRecoveryDiscoveryHandoffStore } from './music-queue-recovery-discovery-handoff-store.js';
import { buildImportCandidateAutoSelectionEvaluation } from './import-candidate-auto-selection-service.js';
import { buildAutomaticLibraryAddAuthority } from './import-candidate-music-queue-auto-safe-add-policy.js';
import { buildRecoveryQualityContext, captureRecoveryObservation, hasCurrentRecoveryRecipients, hasSameRecoveryIdentity,
  recoveryBaseline, MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE, MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE } from './music-queue-recovery-policy.js';

const refuse = () => { throw createApiError(409, 'music_queue_recovery_not_current', 'The recovery search results no longer have current acquisition authority'); };
const candidateSnapshot = (candidate) => ({ observation: captureRecoveryObservation(candidate),
  payload: candidate.normalizedPayload, fileCount: candidate.fileCount, lockedFileCount: candidate.lockedFileCount });

/** Search observation, fresh selection and its exact durable download intent share one commit. */
export function createMusicQueueRecoveryDiscoveryHandoffService({ store = createMusicQueueRecoveryDiscoveryHandoffStore(),
  scopedDiscoveryService, recordDiscoverySearchSuccess, assertMaintenanceWriteAllowed,
  createExecutionRun = createImportCandidateExecutionRunStore().createOperationRun,
  withTransaction = createDatabaseTransactionRunner(), lockAccounts = lockAppUserEligibility,
  recordAuditEventFn = recordAuditEvent, qualityPolicyService = createAcquisitionQualityPolicyService(), selectionPolicy } = {}) {
  for (const [name, fn] of Object.entries({ resolveScopedDiscovery: scopedDiscoveryService?.resolveScopedDiscovery,
    recordDiscoverySearchSuccess, assertMaintenanceWriteAllowed, createExecutionRun, withTransaction })) {
    if (typeof fn !== 'function') throw new TypeError(`createMusicQueueRecoveryDiscoveryHandoffService requires ${name}`);
  }
  async function finishScopedDiscovery({ runId, prepared, ingestionResult, successPayload, readiness }) {
    const sourceSearchId = successPayload?.searchId;
    if (typeof sourceSearchId !== 'string' || !sourceSearchId.trim() || successPayload?.metadataReleaseId !== prepared?.metadataReleaseId) return refuse();
    const candidates = await store.listSearchCandidates(sourceSearchId);
    const snapshots = candidates.map(candidateSnapshot);
    return withTransaction(async (queryable) => {
      await assertMaintenanceWriteAllowed({ queryable });
      const participants = await store.readParticipantPolicies({ wantedReleaseIds: prepared.record.authority.wantedReleaseIds, queryable });
      await lockAccounts({ userIds: [...new Set(participants.map((participant) => participant.appUserId))], queryable });
      await store.lockParticipantReleases({ wantedReleaseIds: prepared.record.authority.wantedReleaseIds, queryable });
      await lockLibraryDiscoveryRunCreation({ queryable });
      await store.lockRecoveryCreation(queryable);
      await store.lockParents([prepared.record.failedCandidateId, ...candidates.map((candidate) => candidate.id)], queryable);
      const ownRun = await store.getOrigin(runId, null, queryable);
      if (ownRun?.summary?.triggerSource !== MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE) return refuse();
      const previous = ownRun.summary.musicQueueRecovery?.continuation;
      if (previous) {
        if (previous.sourceSearchId !== sourceSearchId) return refuse();
        return previous.result;
      }
      const current = await scopedDiscoveryService.resolveScopedDiscovery({ runId, dispatchedAt: prepared.dispatchedAt, queryable });
      if (!isDeepStrictEqual(current.snapshot, prepared.snapshot)) return refuse();
      const freshCandidates = await store.listSearchCandidates(sourceSearchId, queryable);
      if (!isDeepStrictEqual(snapshots, freshCandidates.map(candidateSnapshot))) return refuse();
      const failed = await store.getCandidate(prepared.record.failedCandidateId, queryable);
      if (freshCandidates.some((candidate) => !hasSameRecoveryIdentity(failed, candidate)
        || !hasCurrentRecoveryRecipients(candidate, participants))) return refuse();
      const contexts = new Map();
      for (const candidate of freshCandidates) contexts.set(candidate.id, await buildRecoveryQualityContext({
        failedCandidate: failed, candidate, participants, baselineRequirement: current.record.baselineRequirement }));
      const evaluation = buildImportCandidateAutoSelectionEvaluation({ candidates: freshCandidates, policy: selectionPolicy,
        qualityPolicyService: { evaluateQualityEvidence: ({ candidate }) => {
          const context = contexts.get(candidate.id);
          return qualityPolicyService.evaluateQualityEvidence({ candidate, profileCode: context.profileCode,
            qualityOverride: context.qualityOverride, minimumBitrateKbps: context.minimumBitrateKbps ?? null });
        } } });
      const best = evaluation.bestCandidate;
      const skippedReason = readiness?.ready !== true ? readiness?.skippedReason ?? 'automatic_download_not_ready'
        : freshCandidates.length > 100 ? 'too_many_candidates'
          : evaluation.skippedReason ?? (evaluation.readiness?.code !== 'auto_selectable' ? evaluation.readiness?.code ?? 'no_candidates'
            : !['pending','held'].includes(best?.status) ? 'best_candidate_not_reviewable' : null);
      const autoSelection = { attempted: true, selected: false, sourceSearchId, candidateCount: freshCandidates.length,
        scoredCandidateCount: evaluation.scoredCandidateCount, quality: evaluation.quality, readiness: evaluation.readiness,
        ...(skippedReason ? { skippedReason } : {}) };
      let autoDownloadStart = { attempted: true, started: false, sourceSearchId, skippedReason: skippedReason ?? 'automatic_download_not_ready' };
      if (!skippedReason) {
        const context = contexts.get(best.id);
        const selected = await store.selectSearchCandidate({ candidate: best, context,
          failedCandidateId: failed.id, discoveryRunId: runId }, queryable);
        await recordAuditEventFn({ actorType: 'system', actorUserId: null, eventType: 'import_candidate_selected',
          entityType: 'import_candidate', entityId: selected.id, summary: 'Music Queue selected a high-confidence recovery match',
          details: { discoveryRunId: runId } }, queryable);
        const child = await createExecutionRun({ queryable, requestedCandidateCount: 1, status: 'pending', triggeredByUserId: null,
          summary: { currentStep: 'Queued after guarded recovery search', executionMode: 'download_enqueue', requestedCandidateCount: 1,
            selectedCandidateId: selected.id, sourceSearchId, sourceWantedReleaseId: current.record.authority.wantedReleaseId,
            triggerSource: MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE,
            musicQueueRecovery: { originRunId: current.record.originRunId, discoveryRunId: runId,
              failedCandidateId: failed.id, failedSourceSearchId: sourceSearchId, previousSearchId: current.record.failedSourceSearchId,
              metadataReleaseId: current.metadataReleaseId, authority: buildAutomaticLibraryAddAuthority(selected),
              selectedObservation: captureRecoveryObservation(selected), baselineRequirement: recoveryBaseline(context) } } });
        await recordAuditEventFn({ actorType: 'system', actorUserId: null,
          eventType: operationRunRegistry.importCandidateExecutionPlanning.startedEventType, entityType: 'operation_run', entityId: child.id,
          summary: 'Music Queue queued the guarded recovery search match', details: { discoveryRunId: runId, selectedCandidateId: selected.id } }, queryable);
        Object.assign(autoSelection, { selected: true, selectedCandidateId: selected.id });
        autoDownloadStart = { attempted: true, started: true, sourceSearchId, selectedCandidateId: selected.id,
          runId: child.id, triggerSource: MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE };
      }
      const result = { autoSelection, autoDownloadStart };
      await recordDiscoverySearchSuccess({ ...successPayload, candidateCount: ingestionResult.candidateCount,
        fileCount: ingestionResult.fileCount, autoSelection, autoDownloadStart, queryable });
      await recordAuditEventFn({ actorType: 'system', actorUserId: null, eventType: 'music_queue_recovery_search_completed',
        entityType: 'operation_run', entityId: runId, summary: 'Music Queue accepted the current recovery search results',
        details: { sourceSearchId, selectedCandidateId: autoSelection.selectedCandidateId ?? null } }, queryable);
      await store.saveContinuation({ runId, sourceSearchId, result }, queryable);
      return result;
    });
  }
  return { finishScopedDiscovery };
}
