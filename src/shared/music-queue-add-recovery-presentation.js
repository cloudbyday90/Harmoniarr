/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

export const MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES = Object.freeze({
  ADD_FAILED: 'add_failed',
  AUDIO_CHECK_FAILED: 'audio_check_failed',
  LIBRARY_COLLISION: 'library_collision',
  LOSSY_AUDIO: 'lossy_audio',
  MEDIA_VERIFICATION: 'media_verification',
  SOURCE_PATH_UNAVAILABLE: 'source_path_unavailable',
  SUSPICIOUS_LOSSLESS: 'suspicious_lossless',
  UNSAFE_ADD_PLAN: 'unsafe_add_plan',
});

const KNOWN_REASON_CODES = new Set(Object.values(MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES));

const DEFAULT_RECOVERY = Object.freeze({
  actionCode: 'review_add_plan',
  actionLabel: 'Review add plan',
  code: 'unsafe_add_plan',
  detail: 'Harmoniarr stopped before changing your library because the completed download needs a safe add review.',
  nextStep: 'Review the release, then open Advanced diagnostics if you need the detailed add plan.',
  reasonCode: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.UNSAFE_ADD_PLAN,
  title: 'Adding this release needs review',
});

const RECOVERY_BY_REASON_CODE = Object.freeze({
  [MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.ADD_FAILED]: Object.freeze({
    actionCode: 'review_add_plan',
    actionLabel: 'Review add result',
    code: 'add_failed',
    detail: 'Harmoniarr stopped while adding these files and left your library unchanged where it could not finish safely.',
    nextStep: 'Review the release, then open Advanced diagnostics if you need the file-by-file result.',
    reasonCode: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.ADD_FAILED,
    title: 'Adding this release stopped safely',
  }),
  [MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.AUDIO_CHECK_FAILED]: Object.freeze({
    actionCode: 'review_add_plan',
    actionLabel: 'Review audio check',
    code: 'media_verification',
    detail: 'Harmoniarr could not finish checking the downloaded audio, so it was not added to your library.',
    nextStep: 'Review the release audio check before trying another match. Advanced diagnostics has the recorded check result.',
    reasonCode: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.AUDIO_CHECK_FAILED,
    title: 'Audio check could not finish',
  }),
  [MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.LIBRARY_COLLISION]: Object.freeze({
    actionCode: 'review_add_plan',
    actionLabel: 'Review library conflict',
    code: 'library_collision',
    detail: 'A file for this release already exists in your library, so Harmoniarr stopped before overwriting it.',
    nextStep: 'Review the release, then use Advanced diagnostics to decide how to handle the existing library file.',
    reasonCode: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.LIBRARY_COLLISION,
    title: 'Existing library files need review',
  }),
  [MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.LOSSY_AUDIO]: Object.freeze({
    actionCode: 'review_quality_choice',
    actionLabel: 'Review audio quality',
    code: 'media_verification',
    detail: 'The downloaded audio does not meet the quality you chose, so Harmoniarr left your library unchanged.',
    nextStep: 'Review the quality choice for this release before choosing another match or changing the quality preference.',
    reasonCode: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.LOSSY_AUDIO,
    title: 'Downloaded audio is below your quality setting',
  }),
  [MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.MEDIA_VERIFICATION]: Object.freeze({
    actionCode: 'review_add_plan',
    actionLabel: 'Review audio check',
    code: 'media_verification',
    detail: 'Harmoniarr could not verify the downloaded audio safely, so it was not added to your library.',
    nextStep: 'Review the release audio check before choosing another match. Advanced diagnostics has the recorded verification result.',
    reasonCode: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.MEDIA_VERIFICATION,
    title: 'Audio verification needs review',
  }),
  [MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.SOURCE_PATH_UNAVAILABLE]: Object.freeze({
    actionCode: 'set_up_folders',
    actionLabel: 'Set up folders',
    code: 'source_path_unavailable',
    detail: 'Harmoniarr cannot reach the completed download from its configured folders.',
    nextStep: 'Check the download and library folder setup. Harmoniarr will keep the library unchanged until the files are reachable.',
    reasonCode: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.SOURCE_PATH_UNAVAILABLE,
    settingsRouteLabel: 'Set up folders',
    settingsRouteName: 'settings-media-storage',
    title: 'Completed files are not reachable',
  }),
  [MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.SUSPICIOUS_LOSSLESS]: Object.freeze({
    actionCode: 'review_add_plan',
    actionLabel: 'Review lossless check',
    code: 'media_verification',
    detail: 'This download claims to be lossless, but Harmoniarr could not verify that claim safely. It was not added to your library.',
    nextStep: 'Review the audio check before choosing another match. Advanced diagnostics has the recorded verification result.',
    reasonCode: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.SUSPICIOUS_LOSSLESS,
    title: 'Lossless audio needs review',
  }),
  [MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.UNSAFE_ADD_PLAN]: Object.freeze({
    actionCode: 'review_add_plan',
    actionLabel: 'Review add plan',
    code: 'unsafe_add_plan',
    detail: 'Harmoniarr stopped before changing your library because the safe add plan needs review.',
    nextStep: 'Review the release, then open Advanced diagnostics for the files or saved decisions that need attention.',
    reasonCode: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.UNSAFE_ADD_PLAN,
    title: 'Safe add plan needs review',
  }),
});

const DEFAULT_REASON_BY_BLOCKER_CODE = Object.freeze({
  add_failed: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.ADD_FAILED,
  library_collision: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.LIBRARY_COLLISION,
  media_verification: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.MEDIA_VERIFICATION,
  source_path_unavailable: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.SOURCE_PATH_UNAVAILABLE,
  unsafe_add_plan: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.UNSAFE_ADD_PLAN,
});

export function normalizeMusicQueueAddRecoveryReasonCode(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return KNOWN_REASON_CODES.has(normalized) ? normalized : null;
}

/**
 * Returns a safe, release-level recovery object. Never use worker messages,
 * paths, filenames, source users, or tool output to construct this response.
 */
export function buildMusicQueueAddRecoveryPresentation({
  blockerCode = null,
  recoveryReasonCode = null,
} = {}) {
  const normalizedBlockerCode = typeof blockerCode === 'string'
    ? blockerCode.trim().toLowerCase()
    : null;
  const normalizedReasonCode = normalizeMusicQueueAddRecoveryReasonCode(recoveryReasonCode);
  const defaultReasonCode = DEFAULT_REASON_BY_BLOCKER_CODE[normalizedBlockerCode] ?? null;
  const reasonCode = normalizedBlockerCode === 'media_verification'
    ? (normalizedReasonCode ?? defaultReasonCode)
    : defaultReasonCode;

  return RECOVERY_BY_REASON_CODE[reasonCode] ?? DEFAULT_RECOVERY;
}
