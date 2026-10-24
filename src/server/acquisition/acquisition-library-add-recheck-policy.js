/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { hasQueuedGuardedLibraryAdd } from './acquisition-library-add-policy.js';
import { buildMusicQueueAddRecoveryPresentation, normalizeMusicQueueAddRecoveryReasonCode } from '../../shared/music-queue-add-recovery-presentation.js';

export function isMeasuredQualityReview(facts) {
  return facts?.addBlockerCode === 'media_verification'
    && ['lossy_audio', 'suspicious_lossless'].includes(facts.recoveryReasonCode);
}

/** Current owned facts select static copy; diagnostic strings never become public guidance. */
export function buildPublicLibraryAddReview(facts) {
  if (facts?.candidateStatus !== 'failed' || facts.addBlockerCode !== 'media_verification'
    || facts.hasConflictingCandidate !== false) return null;
  const reasonCode = normalizeMusicQueueAddRecoveryReasonCode(facts.recoveryReasonCode);
  if (!['audio_check_failed', 'lossy_audio', 'suspicious_lossless'].includes(reasonCode)) return null;
  const { title, detail, nextStep } = buildMusicQueueAddRecoveryPresentation({ blockerCode: 'media_verification', recoveryReasonCode: reasonCode });
  return { reasonCode, title, detail, nextStep };
}

export function getLibraryAddRecheckReason(facts) {
  if (facts?.addBlockerCode === 'source_path_unavailable') return 'source_path_unavailable';
  return facts?.addBlockerCode === 'media_verification' && facts.recoveryReasonCode === 'audio_check_failed'
    ? 'audio_check_failed' : null;
}

export function hasQueuedLibraryAddRecheck(facts) {
  return hasQueuedGuardedLibraryAdd(facts);
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
