/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const GUARDED_LIBRARY_ADD_TRIGGER_SOURCES = Object.freeze(['music_queue_manual_add', 'music_queue_prerequisite_recheck', 'music_queue_download_completed']);

export function hasQueuedGuardedLibraryAdd(facts) {
  return facts?.candidateStatus === 'import_pending' && facts.hasConflictingCandidate === false && facts.runMatchesCandidate === true
    && facts.owningTargetMarkerValid === true && GUARDED_LIBRARY_ADD_TRIGGER_SOURCES.includes(facts.activeRunTriggerSource)
    && ['pending', 'running'].includes(facts.activeRunStatus) && facts.activeRunSafetyMode === 'safe_auto';
}

export function isPreparedReleaseLibraryAddEligible({ release, targetUser, facts = release?.libraryAddFacts } = {}) {
  return Boolean(targetUser && targetUser.isDisabled !== true && targetUser.accountStatus !== 'disabled'
    && ['missing', 'partial'].includes(release?.wantedStatus) && release.missingTrackCount > 0
    && release.visibilityState !== 'ignored' && release.evidence?.visibilityState !== 'ignored'
    && release.discoveryLinkExists === true && facts?.candidateStatus === 'import_pending'
    && facts.fileCount > 0 && facts.hasConflictingCandidate === false);
}

export function canAddPreparedReleaseToLibrary(input = {}) {
  return isPreparedReleaseLibraryAddEligible(input) && !(input.facts ?? input.release?.libraryAddFacts)?.activeRunId;
}
