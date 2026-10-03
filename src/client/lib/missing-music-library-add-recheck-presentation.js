/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { SETTINGS_RECOVERY_CONTEXT, buildSettingsRecoveryHandoffLocation, createSettingsRecoveryContext } from './settings-recovery-handoff.js';

const RECOVERY_REASONS = new Set(['source_path_unavailable', 'audio_check_failed']);
const OUTCOME_FEEDBACK = Object.freeze({
  queued: { message: 'Harmoniarr queued this release for library-add checks. The files will be added only if the plan remains safe.', tone: 'success' },
  already_queued: { message: 'Library-add checks are already queued for this release. No additional work was started.', tone: 'info' },
  deferred: { message: 'Another library add is active. This release was left unchanged; check its files again after that work finishes.', tone: 'warning' },
  prerequisite_not_ready: { message: 'The required folders or media tools are not ready. Repair the prerequisite, then check these files again.', tone: 'warning' },
  still_needs_review: { message: 'These completed files still need review before Harmoniarr can add them safely.', tone: 'warning' },
  not_available: { message: 'This release is no longer eligible for this file recheck. Review its current status.', tone: 'warning' },
});

export function buildMissingMusicLibraryAddRecheckFeedback(action) {
  return Object.hasOwn(OUTCOME_FEEDBACK, action?.outcome)
    ? OUTCOME_FEEDBACK[action.outcome]
    : { message: 'Harmoniarr checked the request. Review the current release status.', tone: 'info' };
}

export function buildMissingMusicLibraryAddRecoveryPresentation(detail) {
  const recovery = detail?.libraryAddRecovery;
  const reasonCode = RECOVERY_REASONS.has(recovery?.reasonCode) ? recovery.reasonCode : null;
  const queued = recovery?.queued === true;
  const isReadOnly = detail?.permissions?.isReadOnly === true || detail?.decision?.requestedFor?.accountStatus === 'disabled';
  const canRecheck = !isReadOnly && !queued && Boolean(reasonCode) && detail?.permissions?.canRecheckLibraryAdd === true;
  const canRepairFolders = !isReadOnly && !queued && reasonCode === 'source_path_unavailable' && detail?.permissions?.canRepairFolders === true;
  const context = createSettingsRecoveryContext({ context: SETTINGS_RECOVERY_CONTEXT.MISSING_MUSIC_DECISION, wantedReleaseId: detail?.decision?.decisionId });
  const username = typeof detail?.decision?.requestedFor?.username === 'string'
    ? detail.decision.requestedFor.username.trim() || 'the selected recipient' : 'the selected recipient';
  return {
    canRecheck,
    repairFoldersLocation: canRepairFolders && context ? buildSettingsRecoveryHandoffLocation({ recoveryContext: context, routeName: 'settings-media-storage' }) : null,
    showPanel: Boolean(reasonCode) || queued,
    title: queued ? 'Library-add checks queued' : reasonCode === 'source_path_unavailable' ? 'Completed files are not reachable' : 'Audio check could not finish',
    explanation: queued
      ? 'Harmoniarr will add the completed files only after the current audio and library checks pass.'
      : reasonCode === 'source_path_unavailable'
        ? 'Harmoniarr cannot reach the completed download from its configured folders. A household administrator may need to repair the folder setup. After saving healthy folders, return to this release and check the files again.'
        : 'Harmoniarr could not finish checking the downloaded audio. A household administrator may need to repair the media tools before you try again.',
    actionExplanation: `Check the same completed download for ${username}. This can queue a library add only after the audio and file plan pass the safety checks.`,
  };
}
