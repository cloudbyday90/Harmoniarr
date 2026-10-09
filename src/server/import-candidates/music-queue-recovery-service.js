/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { lockAppUserEligibility } from '../app-user-eligibility-lock-store.js';
import { recordAuditEvent } from '../audit.js';
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';
import { createAcquisitionQualityPolicyService } from '../acquisition/acquisition-quality-policy-service.js';
import { createLibraryDiscoveryRunStore } from '../library/library-discovery-run-store.js';
import { lockLibraryDiscoveryRunCreation } from '../library/library-discovery-run-lock-store.js';
import { buildAutomaticLibraryAddAuthority } from './import-candidate-music-queue-auto-safe-add-policy.js';
import { createMusicQueueRecoveryStore } from './music-queue-recovery-store.js';
import { buildRecoveryQualityContext, getRecoveryPrimary, hasCurrentRecoveryDiscovery, hasCurrentRecoveryRecipients,
  hasOwnedRecoveryOrigin, hasSameRecoveryIdentity, matchesRecoveryObservation, recoveryBaseline,
  captureRecoveryObservation, isValidRecoveryBaseline,
  MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE, MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE } from './music-queue-recovery-policy.js';

const terminalByKind = { download: 'download_failed', rejected: 'download_failed', quality: 'quality_failed', import: 'import_blocked' };

/** One source-run/candidate episode owns all its observations and one acquisition decision. */
export function createMusicQueueRecoveryService({ store = createMusicQueueRecoveryStore(), assertMaintenanceWriteAllowed,
  createExecutionRun, createDiscoveryRun = createLibraryDiscoveryRunStore().createOperationRun,
  withTransaction = createDatabaseTransactionRunner(), lockAccounts = lockAppUserEligibility,
  recordAuditEventFn = recordAuditEvent, qualityPolicyService = createAcquisitionQualityPolicyService(),
  recordSourceOutcome = async () => {}, getNow = () => new Date(), maxAttempts = 3, retryDelayMs = 600_000,
  rediscoveryDelayMs = 7_200_000, maxResearchAttempts = 2 } = {}) {
  for (const [name, fn] of Object.entries({ assertMaintenanceWriteAllowed, createExecutionRun, createDiscoveryRun, withTransaction,
    lockAccounts, recordAuditEventFn, getCandidate: store.getCandidate, getOrigin: store.getOrigin })) {
    if (typeof fn !== 'function') throw new TypeError(`createMusicQueueRecoveryService requires ${name}`);
  }
  async function ownsRecoveryCandidate({ candidate, operationRunId = null }) {
    return hasOwnedRecoveryOrigin(candidate, await store.getOrigin(operationRunId, candidate.id));
  }
  const isCurrentExecutionObservation = ({ candidateId, operationRunId }) => store.isCurrentExecutionOrigin(candidateId, operationRunId);
  async function audit({ eventType, entityId, entityType = 'import_candidate', details, summary }, queryable) {
    await recordAuditEventFn({ actorType: 'system', actorUserId: null, eventType, entityId, entityType, details, summary }, queryable);
  }
  async function handleMusicQueueRecovery({ kind, failedCandidateId, operationRunId = null, observation = null, failureReason = null,
    addBlockerCode = null, recoveryReasonCode = null, canRecover = false } = {}) {
    const original = await store.getCandidate(failedCandidateId);
    if (!original) return { recovered: false, reason: 'failed_candidate_not_found', scopedRecovery: true };
    const identity = buildAutomaticLibraryAddAuthority(original);
    const participants = identity ? await store.readParticipantPolicies({ wantedReleaseIds: identity.wantedReleaseIds }) : [];
    const primary = participants.find((participant) => participant.wantedReleaseId === getRecoveryPrimary(original));
    const metadataReleaseId = primary?.metadataReleaseId ?? null;
    const sourceReservation = await store.readExecutionReservation(original.id);
    const candidates = metadataReleaseId && (kind !== 'import' || canRecover) ? await store.listCandidateIds({ failedCandidateId,
      metadataReleaseId, sourceSearchId: original.sourceSearchId, maxAttempts }) : [];
    let terminalOutcomeEvidence;
    const result = await withTransaction(async (queryable) => {
      await assertMaintenanceWriteAllowed({ queryable });
      if (participants.length) {
        await lockAccounts({ userIds: [...new Set(participants.map((participant) => participant.appUserId))], queryable });
        await store.lockParticipantReleases({ wantedReleaseIds: identity.wantedReleaseIds, queryable });
      }
      await lockLibraryDiscoveryRunCreation({ queryable });
      await store.lockRecoveryCreation(queryable);
      await store.lockParents([failedCandidateId, ...candidates], queryable);
      const failed = await store.getCandidate(failedCandidateId, queryable);
      const prior = await store.getEpisode(failedCandidateId, operationRunId, queryable);
      if (prior) return { ...prior.result, episodeReplayed: true };
      const base = { recovered: false, failedCandidateId, sourceSearchId: failed?.sourceSearchId ?? null,
        metadataReleaseId, scopedRecovery: true, terminalOutcome: terminalByKind[kind] };
      if (!failed || !matchesRecoveryObservation(failed, observation)
        || !(['quality','import'].includes(kind) ? ['import_pending','failed'] : ['selected','downloading','failed']).includes(failed.status)) {
        return { ...base, reason: 'recovery_observation_stale' };
      }
      const freshParticipants = identity ? await store.readParticipantPolicies({ wantedReleaseIds: identity.wantedReleaseIds, queryable }) : [];
      const discovery = metadataReleaseId ? await store.getDiscovery(metadataReleaseId, queryable) : null;
      const origin = await store.getOrigin(operationRunId, failedCandidateId, queryable);
      if (origin?.operation_type === 'import_candidate_execution_planning'
        && !await store.isCurrentExecutionOrigin(failedCandidateId, operationRunId, queryable)) return { ...base, reason: 'recovery_observation_stale' };
      const accepted = origin?.summary?.musicQueueRecovery ?? (sourceReservation?.summary?.sourceSearchId === failed.sourceSearchId
        && hasSameRecoveryIdentity(original, failed) ? sourceReservation.summary.musicQueueRecovery : null);
      const discoverySearchId = accepted?.failedSourceSearchId ?? failed.sourceSearchId;
      const eligible = origin?.has_item === true && hasCurrentRecoveryRecipients(failed, freshParticipants)
        && !failed.normalizedPayload?.requestOwnership?.externalRequestReleaseIntentId
        && (!accepted || (isValidRecoveryBaseline(accepted.baselineRequirement) && accepted.metadataReleaseId === metadataReleaseId
          && isDeepStrictEqual(accepted.authority, buildAutomaticLibraryAddAuthority(failed))))
        && hasCurrentRecoveryDiscovery(discovery, discoverySearchId)
        && !await store.findActiveSelection({ failedCandidateId, metadataReleaseId, queryable });
      const terminal = await store.recordTerminal({ candidate: failed, kind, reason: failureReason,
        blockerCode: addBlockerCode, recoveryReasonCode }, queryable);
      await audit({ eventType: terminal.event.eventType, entityId: failed.id,
        details: { originRunId: operationRunId, terminalOutcome: terminalByKind[kind], ...(addBlockerCode ? { addBlockerCode } : {}),
          ...(recoveryReasonCode ? { recoveryReasonCode } : {}) }, summary: 'Music Queue observed a stopped acquisition attempt' }, queryable);
      if (kind !== 'import' || canRecover) terminalOutcomeEvidence = { eventType: terminal.event.eventType,
        occurredAt: terminal.candidate.updatedAt, username: failed.username, outcome: 'failure', reason: failureReason,
        ...(kind === 'quality' ? { qualityWeight: 0 } : {}) };
      let decision = { ...base, terminalObservationRecorded: true,
        ...(addBlockerCode ? { addBlockerCode } : {}), ...(recoveryReasonCode ? { recoveryReasonCode } : {}),
        ...(kind === 'import' && !canRecover && !recoveryReasonCode ? { requiresOperator: true } : {}),
        reason: kind === 'import' && !canRecover ? recoveryReasonCode ? 'environmental_prerequisite_unavailable' : 'import_blocker_requires_operator'
          : eligible ? 'no_recovery_candidate_available' : 'recovery_scope_not_current' };
      if (eligible && (kind !== 'import' || canRecover)) {
        const attempted = await store.incrementAttempt(failed.id, queryable);
        const required = await buildRecoveryQualityContext({ failedCandidate: failed, participants: freshParticipants,
          baselineRequirement: accepted?.baselineRequirement ?? null });
        let selected; let selectedContext;
        const retry = kind === 'rejected' && attempted.downloadAttemptCount < maxAttempts;
        for (const candidateId of retry ? [failed.id] : candidates) {
          const candidate = await store.getCandidate(candidateId, queryable);
          if (!candidate || !hasSameRecoveryIdentity(failed, candidate) || !hasCurrentRecoveryRecipients(candidate, freshParticipants)
            || (!retry && (!['pending','held'].includes(candidate.status)
            || candidate.downloadAttemptCount >= maxAttempts)) || !(candidate.files?.some((file) => !file.isLocked))) continue;
          const context = await buildRecoveryQualityContext({ failedCandidate: failed, candidate, participants: freshParticipants,
            baselineRequirement: recoveryBaseline(required) });
          const quality = qualityPolicyService.evaluateQualityEvidence({ candidate, profileCode: context.profileCode,
            qualityOverride: context.qualityOverride, minimumBitrateKbps: context.minimumBitrateKbps ?? null });
          if (!quality.autoDownloadEligible) continue;
          selected = await store.selectCandidate({ candidate, context, failedCandidateId: failed.id, retry }, queryable);
          selectedContext = context; break;
        }
        if (selected) {
          const nextAttemptAt = retry ? new Date(getNow().getTime() + retryDelayMs).toISOString() : null;
          const run = await createExecutionRun({ queryable, status: 'pending', nextAttemptAt, triggeredByUserId: null,
            requestedCandidateCount: 1, summary: { currentStep: 'queued by scoped Music Queue recovery', executionMode: 'download_enqueue',
              requestedCandidateCount: 1, selectedCandidateId: selected.id, sourceSearchId: selected.sourceSearchId,
              sourceWantedReleaseId: identity.wantedReleaseId, triggerSource: MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE,
              musicQueueRecovery: { originRunId: operationRunId, failedCandidateId: failed.id, failedSourceSearchId: discoverySearchId,
                metadataReleaseId, authority: buildAutomaticLibraryAddAuthority(selected), selectedObservation: captureRecoveryObservation(selected),
                baselineRequirement: recoveryBaseline(selectedContext) } } });
          await audit({ eventType: operationRunRegistry.importCandidateExecutionPlanning.startedEventType, entityId: run.id,
            entityType: 'operation_run', details: { runId: run.id, triggerSource: MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE,
              selectedCandidateId: selected.id, originRunId: operationRunId }, summary: 'Music Queue queued one guarded recovery download' }, queryable);
          decision = { ...decision, recovered: true, reason: retry ? 'candidate_retry_scheduled' : 'candidate_promoted',
            nextCandidateId: selected.id, recoveryRunId: run.id, scopedRecoveryQueued: true,
            ...(retry ? { retrySameCandidate: true, retryAt: nextAttemptAt } : {}) };
        } else if (kind !== 'quality' && discovery.researchAttemptCount < maxResearchAttempts
          && !(discovery.requestStatus === 'ready' && Date.parse(discovery.nextSearchAfter) > getNow().getTime())) {
          const nextSearchAfter = new Date(getNow().getTime() + rediscoveryDelayMs).toISOString();
          const run = await createDiscoveryRun({ queryable, status: 'pending', nextAttemptAt: nextSearchAfter,
            triggerSource: MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE, triggeredByUserId: null,
            summary: { musicQueueRecovery: { originRunId: operationRunId, failedCandidateId: failed.id,
              failedSourceSearchId: discoverySearchId, metadataReleaseId, nextSearchAfter, authority: identity, baselineRequirement: recoveryBaseline(required) } } });
          await store.scheduleRediscovery({ discoveryId: discovery.id, nextSearchAfter, runId: run.id,
            failedCandidateId: failed.id, sourceSearchId: discoverySearchId }, queryable);
          await audit({ eventType: operationRunRegistry.libraryDiscoveryDispatch.startedEventType, entityId: run.id,
            entityType: 'operation_run', details: { runId: run.id, triggerSource: MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE,
              metadataReleaseId, originRunId: operationRunId }, summary: 'Music Queue queued one guarded delayed search' }, queryable);
          decision = { ...decision, reason: 'rediscovery_scheduled', rediscovery: { scheduled: true, discoveryRunId: run.id, nextSearchAfter } };
        }
        decision.failedAttemptCount = attempted.downloadAttemptCount;
      }
      await store.saveEpisode({ candidate: terminal.candidate, originRunId: operationRunId, result: decision, observation }, queryable);
      return decision;
    });
    if (terminalOutcomeEvidence && !result.episodeReplayed && !(kind === 'rejected' && result.retrySameCandidate)) {
      try { await recordSourceOutcome(terminalOutcomeEvidence); } catch { /* Supplemental source evidence cannot undo committed intent. */ }
    }
    return result;
  }
  return { ownsRecoveryCandidate, isCurrentExecutionObservation, handleMusicQueueRecovery, store };
}
