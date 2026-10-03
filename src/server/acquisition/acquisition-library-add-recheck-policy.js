/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function getLibraryAddRecheckReason(facts) {
  if (facts?.addBlockerCode === 'source_path_unavailable') return 'source_path_unavailable';
  return facts?.addBlockerCode === 'media_verification' && facts.recoveryReasonCode === 'audio_check_failed'
    ? 'audio_check_failed' : null;
}

export function hasQueuedLibraryAddRecheck(facts) {
  return facts?.candidateStatus === 'import_pending' && facts.runMatchesCandidate === true
    && ['pending', 'running'].includes(facts.activeRunStatus) && facts.activeRunSafetyMode === 'safe_auto';
}

export function canRecheckLibraryAdd({ release, targetUser, facts = release?.libraryAddRecoveryFacts } = {}) {
  return Boolean(targetUser && targetUser.isDisabled !== true && targetUser.accountStatus !== 'disabled'
    && ['missing', 'partial'].includes(release?.wantedStatus) && release.missingTrackCount > 0
    && release.visibilityState !== 'ignored' && release.evidence?.visibilityState !== 'ignored'
    && release.discoveryLinkExists === true && facts?.candidateStatus === 'failed'
    && facts.hasConflictingCandidate === false && getLibraryAddRecheckReason(facts));
}

export function buildPublicLibraryAddRecovery(facts) {
  const queued = hasQueuedLibraryAddRecheck(facts);
  return { reasonCode: getLibraryAddRecheckReason(facts), queued,
    runId: queued && typeof facts.activeRunId === 'string' ? facts.activeRunId : null };
}
