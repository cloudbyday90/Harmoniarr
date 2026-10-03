/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const OUTCOME_FEEDBACK = Object.freeze({
  queued: { message: 'Harmoniarr queued this release to be added to the music library. Audio and file checks will run before any files move.', tone: 'success' },
  already_queued: { message: 'Library-add work is already queued for this release. No additional work was started.', tone: 'info' },
  deferred: { message: 'Another library add is active. This release was left unchanged; try again after that work finishes.', tone: 'warning' },
  still_needs_review: { message: 'These prepared files need review before Harmoniarr can add them safely.', tone: 'warning' },
  not_available: { message: 'This release is no longer ready for this library add. Review its current status.', tone: 'warning' },
});

function text(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function buildMissingMusicLibraryAddFeedback(action) {
  return Object.hasOwn(OUTCOME_FEEDBACK, action?.outcome) ? OUTCOME_FEEDBACK[action.outcome]
    : { message: 'Harmoniarr checked the request. Review the current release status.', tone: 'info' };
}

export function buildMissingMusicLibraryAddPresentation(detail) {
  const decision = detail?.decision;
  const username = text(decision?.requestedFor?.username, 'the selected recipient');
  const isReadOnly = detail?.permissions?.isReadOnly === true || decision?.requestedFor?.accountStatus === 'disabled';
  return {
    canAdd: !isReadOnly && detail?.permissions?.canAddToLibrary === true,
    explanation: `Add the prepared download for ${username} to the music library. Audio and file checks still apply.`,
    confirmation: `Harmoniarr will check the prepared download for ${text(decision?.release?.title, 'this release')} by ${text(decision?.release?.artistName, 'the selected artist')}, requested for ${username}, and queue it to be added to the music library.`,
    safetyExplanation: 'The worker will check the audio and file plan again before moving files. Quality requirements and file-conflict checks still apply.',
  };
}
