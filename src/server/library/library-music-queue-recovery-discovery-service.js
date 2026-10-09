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
import { createOperationRunPauseError } from '../operation-run-cancellation.js';
import { createMusicQueueRecoveryStore } from '../import-candidates/music-queue-recovery-store.js';
import { createMusicQueueRecoveryLifecycleService } from '../import-candidates/music-queue-recovery-lifecycle-service.js';
import { buildAutomaticLibraryAddAuthority } from '../import-candidates/import-candidate-music-queue-auto-safe-add-policy.js';
import { buildRecoveryQualityContext, captureRecoveryObservation, hasCurrentRecoveryDiscovery, hasCurrentRecoveryRecipients, isValidRecoveryBaseline,
  MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE } from '../import-candidates/music-queue-recovery-policy.js';
import { recoveryParticipantSnapshot } from '../import-candidates/music-queue-recovery-execution-policy-service.js';

const refuse = () => { throw createApiError(409, 'music_queue_recovery_not_current', 'This delayed recovery search no longer has current authority'); };
const validId = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
export function createLibraryMusicQueueRecoveryDiscoveryService({ store = createMusicQueueRecoveryStore(), assertMaintenanceWriteAllowed = async () => {},
  withTransaction = createDatabaseTransactionRunner(), lockAccounts = lockAppUserEligibility,
  lifecycleService = createMusicQueueRecoveryLifecycleService({ store, withTransaction }) } = {}) {
  async function resolveScopedDiscovery({ runId, dispatchedAt = null, queryable = null }) {
    const run = await store.getOrigin(runId, null, queryable);
    const record = run?.summary?.musicQueueRecovery;
    if (run?.summary?.triggerSource !== MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE || !['pending','running'].includes(run.status)
      || !record?.authority || record.retired === true || record.superseded === true || !isValidRecoveryBaseline(record.baselineRequirement)
      || !validId(record.failedCandidateId) || !validId(record.metadataReleaseId)
      || typeof record.failedSourceSearchId !== 'string' || !record.failedSourceSearchId.trim()
      || typeof record.nextSearchAfter !== 'string' || !Number.isFinite(Date.parse(record.nextSearchAfter))) return refuse();
    const reservation = await store.readDiscoveryReservation(record.metadataReleaseId, queryable);
    if (reservation?.id !== runId) return refuse();
    const candidate = await store.getCandidate(record.failedCandidateId, queryable);
    const identity = buildAutomaticLibraryAddAuthority(candidate);
    if (candidate?.status !== 'failed' || !identity || !isDeepStrictEqual(identity, record.authority)) return refuse();
    const participants = await store.readParticipantPolicies({ wantedReleaseIds: record.authority.wantedReleaseIds, queryable });
    const discovery = await store.getDiscovery(record.metadataReleaseId, queryable);
    const marker = discovery?.evidence?.downloadRecoveryRediscovery;
    const ownsRequest = marker?.owningRunId === runId && marker.state !== 'guard_refused'
      && marker.sourceSearchId === record.failedSourceSearchId;
    const ownedClaim = dispatchedAt != null && discovery?.requestStatus === 'cooldown'
      && discovery.evidence.lastDispatchRunId === runId && Date.parse(discovery.evidence.lastDispatchAttemptedAt) === Date.parse(dispatchedAt)
      && discovery.evidence.lastSearchId === record.failedSourceSearchId;
    const readyRequest = dispatchedAt == null && discovery?.requestStatus === 'ready'
      && Number.isFinite(Date.parse(discovery.nextSearchAfter))
      && new Date(discovery.nextSearchAfter).toISOString() === new Date(record.nextSearchAfter).toISOString()
      && hasCurrentRecoveryDiscovery(discovery, record.failedSourceSearchId);
    if (!ownsRequest || !(ownedClaim || readyRequest) || !hasCurrentRecoveryRecipients(candidate, participants)
      || participants.some((participant) => participant.metadataReleaseId !== record.metadataReleaseId)
      || await store.findActiveSelection({ failedCandidateId: candidate.id, metadataReleaseId: record.metadataReleaseId, queryable })) return refuse();
    const context = await buildRecoveryQualityContext({ failedCandidate: candidate, participants, baselineRequirement: record.baselineRequirement });
    return { record, context, metadataReleaseId: record.metadataReleaseId,
      requestOwnership: record.authority.requestOwnership.present ? record.authority.requestOwnership.value : null,
      snapshot: { record, context, candidate: captureRecoveryObservation(candidate), participants: recoveryParticipantSnapshot(participants) } };
  }
  async function claimScopedDiscovery({ runId, dispatchedAt, nextSearchAfter, claimDiscoveryRequest }) {
    const prepared = await resolveScopedDiscovery({ runId });
    if (Date.parse(prepared.record.nextSearchAfter) > Date.parse(dispatchedAt)) {
      throw createOperationRunPauseError({ runId, pauseCode: 'music_queue_recovery_waiting', nextRetryAt: prepared.record.nextSearchAfter,
        message: 'The guarded recovery search is waiting for its saved deadline' });
    }
    return withTransaction(async (queryable) => {
      await assertMaintenanceWriteAllowed({ queryable });
      const participants = await store.readParticipantPolicies({ wantedReleaseIds: prepared.record.authority.wantedReleaseIds, queryable });
      await lockAccounts({ userIds: [...new Set(participants.map((participant) => participant.appUserId))], queryable });
      await store.lockParticipantReleases({ wantedReleaseIds: prepared.record.authority.wantedReleaseIds, queryable });
      await store.lockParents([prepared.record.failedCandidateId], queryable);
      const current = await resolveScopedDiscovery({ runId, queryable });
      if (!isDeepStrictEqual(prepared.snapshot, current.snapshot)) return refuse();
      const claimed = await claimDiscoveryRequest({ queryable, metadataReleaseId: prepared.metadataReleaseId, runId, dispatchedAt, nextSearchAfter });
      if (!claimed) return refuse();
      return { claimed, prepared: { ...current, dispatchedAt } };
    });
  }
  async function assertScopedDiscoveryCurrent({ runId, prepared }) {
    await assertMaintenanceWriteAllowed();
    const current = await resolveScopedDiscovery({ runId, dispatchedAt: prepared.dispatchedAt });
    if (!isDeepStrictEqual(current.snapshot, prepared.snapshot)) return refuse();
  }
  return { resolveScopedDiscovery, claimScopedDiscovery, assertScopedDiscoveryCurrent,
    retireScopedDiscovery: ({ runId, knownDispatchAttemptedAt = null }) => lifecycleService.retireDiscovery({ runId, knownDispatchAttemptedAt }) };
}
