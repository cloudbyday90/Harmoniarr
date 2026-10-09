/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { createAcquisitionQualityPolicyService } from '../acquisition/acquisition-quality-policy-service.js';
import { buildAutomaticLibraryAddAuthority, hasPersistedMusicQueueOwnership } from '../import-candidates/import-candidate-music-queue-auto-safe-add-policy.js';
import { buildRecoveryQualityContext, hasCurrentRecoveryDiscovery, hasCurrentRecoveryRecipients,
  isValidRecoveryBaseline, matchesAcceptedRecoveryProvenance, MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE,
  MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE } from '../import-candidates/music-queue-recovery-policy.js';

const qualityPolicy = createAcquisitionQualityPolicyService();
const active = (status) => ['pending', 'running'].includes(status);
const count = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
const terminalItems = new Set(['blocked', 'queue_failed', 'apply_failed', 'failed', 'completed', 'cancelled']);

/** Read-only policy shares owning identity/current-policy checks; it never authorizes a write. */
export async function deriveWantedRecoveryProgress({ entries, wantedReleaseId, metadataReleaseId }) {
  if (!Array.isArray(entries)) return null;
  const facts = { recoveryExecution: { status: null, candidateMatches: false, authorityReserved: false, reservationRetained: false },
    currentConfirmedTransferCount: 0, currentExecutionStatusCounts: {}, legacyRecoverySelection: false, recoverySelectionNeedsReview: false };
  for (const entry of entries) {
    const candidate = entry?.candidate;
    if (!candidate || !['selected', 'downloading'].includes(candidate.status)) continue;
    const run = entry.recoveryRun?.summary?.musicQueueRecovery?.retired === true && entry.independentlySelected === true
      ? null : entry.recoveryRun;
    const record = run?.summary?.musicQueueRecovery;
    const authority = buildAutomaticLibraryAddAuthority(candidate);
    if (!run && candidate.status === 'selected' && entry.legacyRecoverySelection === true) facts.legacyRecoverySelection = true;
    if (run) {
      const belongs = record?.metadataReleaseId === metadataReleaseId
        && Array.isArray(record.authority?.wantedReleaseIds) && record.authority.wantedReleaseIds.includes(wantedReleaseId);
      const known = belongs || run.summary?.sourceWantedReleaseId === wantedReleaseId;
      if (known && candidate.status === 'selected' && record?.retired === true) facts.recoverySelectionNeedsReview = true;
      const matches = belongs && authority != null && run.summary?.triggerSource === MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE
        && run.summary.selectedCandidateId === candidate.id && run.summary.sourceSearchId === candidate.sourceSearchId
        && isDeepStrictEqual(authority, record.authority)
        && matchesAcceptedRecoveryProvenance(candidate, record.selectedObservation);
      const currentOrigin = entry.latestExecutionOriginId === run.id;
      if (matches && currentOrigin && record.retired !== true) facts.currentConfirmedTransferCount += count(entry.confirmedTransferCount);
      if (known && candidate.status === 'selected' && record?.retired !== true) facts.recoveryExecution.reservationRetained = true;
      if (!known || !active(run.status) || record?.retired === true) continue;
      let reserved = false;
      if (matches && currentOrigin && candidate.status === 'selected' && isValidRecoveryBaseline(record.baselineRequirement)
        && run.cancelRequested !== true && entry.hasConflictingSelection === false
        && hasCurrentRecoveryRecipients(candidate, entry.participants ?? [])
        && hasCurrentRecoveryDiscovery(entry.discovery, record.failedSourceSearchId)) {
        const context = await buildRecoveryQualityContext({ failedCandidate: candidate, participants: entry.participants,
          baselineRequirement: record.baselineRequirement });
        reserved = qualityPolicy.evaluateQualityEvidence({ candidate, profileCode: context.profileCode,
          qualityOverride: context.qualityOverride, minimumBitrateKbps: context.minimumBitrateKbps ?? null }).autoDownloadEligible === true;
      }
      if ((reserved && !facts.recoveryExecution.authorityReserved)
        || (reserved === facts.recoveryExecution.authorityReserved && facts.recoveryExecution.status !== 'running')) {
        facts.recoveryExecution = { status: run.status, candidateMatches: matches, authorityReserved: reserved,
          reservationRetained: facts.recoveryExecution.reservationRetained };
      }
      continue;
    }
    const ownsTarget = !hasPersistedMusicQueueOwnership(candidate)
      || authority?.wantedReleaseIds.includes(wantedReleaseId) === true;
    if (!ownsTarget) continue;
    facts.currentConfirmedTransferCount += count(entry.confirmedTransferCount);
    if (candidate.status !== 'selected' || candidate.selectionReason === 'recovery_cascade') continue;
    for (const ordinary of entry.ordinaryRuns ?? []) {
      if (!active(ordinary.status) || terminalItems.has(ordinary.itemStatus)) continue;
      facts.currentExecutionStatusCounts[ordinary.status] = (facts.currentExecutionStatusCounts[ordinary.status] ?? 0) + 1;
    }
  }
  return facts;
}

/** An unresolved search handoff reserves its request without promising further work. */
export function deriveWantedRecoveryDiscovery({ entry, wantedReleaseId, metadataReleaseId }) {
  if (!entry) return null;
  const run = entry.recoveryRun;
  const record = run?.summary?.musicQueueRecovery;
  const discovery = entry.discovery;
  const marker = discovery?.evidence?.downloadRecoveryRediscovery;
  const retained = run?.summary?.triggerSource === MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE
    && marker?.owningRunId === run.id && !['completed', 'guard_refused'].includes(marker.state)
    && record?.metadataReleaseId === metadataReleaseId
    && record.retired !== true && record.superseded !== true
    && Array.isArray(record.authority?.wantedReleaseIds) && record.authority.wantedReleaseIds.includes(wantedReleaseId)
    && typeof record.failedSourceSearchId === 'string' && record.failedSourceSearchId.trim() !== ''
    && marker.sourceSearchId === record.failedSourceSearchId && discovery.evidence.lastSearchId === record.failedSourceSearchId;
  if (!retained) return null;
  const facts = { status: null, reservationRetained: true };
  const candidate = entry.candidate;
  if (!active(run.status) || run.cancelRequested === true || entry.latestReservationId !== run.id
    || entry.hasConflictingSelection !== false || candidate?.id !== record.failedCandidateId || candidate.status !== 'failed'
    || !isValidRecoveryBaseline(record.baselineRequirement)
    || !isDeepStrictEqual(buildAutomaticLibraryAddAuthority(candidate), record.authority)
    || !hasCurrentRecoveryRecipients(candidate, entry.participants ?? [])) return facts;
  const deadline = Date.parse(record.nextSearchAfter);
  const ready = discovery.requestStatus === 'ready' && hasCurrentRecoveryDiscovery(discovery, record.failedSourceSearchId)
    && Number.isFinite(deadline) && Date.parse(discovery.nextSearchAfter) === deadline;
  const claimed = run.status === 'running' && discovery.requestStatus === 'cooldown'
    && discovery.searchMode === 'automatic' && discovery.evidence.lastDispatchRunId === run.id
    && Number.isFinite(Date.parse(discovery.evidence.lastDispatchAttemptedAt));
  facts.status = ready ? 'pending' : claimed ? 'running' : null;
  return facts;
}
