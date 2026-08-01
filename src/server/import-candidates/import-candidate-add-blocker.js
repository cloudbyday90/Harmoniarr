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

import {
  MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES,
  normalizeMusicQueueAddRecoveryReasonCode,
} from '../../shared/music-queue-add-recovery-presentation.js';

export const IMPORT_CANDIDATE_ADD_BLOCKER_CODES = Object.freeze({
  ADD_FAILED: 'add_failed',
  LIBRARY_COLLISION: 'library_collision',
  MEDIA_VERIFICATION: 'media_verification',
  SOURCE_PATH_UNAVAILABLE: 'source_path_unavailable',
  UNSAFE_ADD_PLAN: 'unsafe_add_plan',
});

const KNOWN_ADD_BLOCKER_CODES = new Set(Object.values(IMPORT_CANDIDATE_ADD_BLOCKER_CODES));

const LOSSY_AUDIO_BLOCKER_CODE_PATTERN = /^safe_auto_quality_(below_minimum|codec_extension_mismatch|lossless_low_bitrate|low_bitrate)$/;
const SUSPICIOUS_LOSSLESS_BLOCKER_CODE_PATTERN = /^safe_auto_spectral_(suspicious|transcoded)$/;

function normalizeQualityGateBlockerCodes(qualityGate) {
  if (!Array.isArray(qualityGate?.blockers)) {
    return [];
  }

  return qualityGate.blockers
    .map((blocker) => (typeof blocker?.code === 'string' ? blocker.code.trim().toLowerCase() : ''))
    .filter(Boolean);
}

export function normalizeImportCandidateAddBlockerCode(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return KNOWN_ADD_BLOCKER_CODES.has(normalized) ? normalized : null;
}

export function deriveImportCandidateAddBlockerCode({
  applyOutcome = null,
  itemStatus = null,
  previewBlockerCode = null,
} = {}) {
  const normalizedPreviewBlockerCode = normalizeImportCandidateAddBlockerCode(previewBlockerCode);
  if (normalizedPreviewBlockerCode) {
    return normalizedPreviewBlockerCode;
  }

  if (applyOutcome === 'quality_blocked') {
    return IMPORT_CANDIDATE_ADD_BLOCKER_CODES.MEDIA_VERIFICATION;
  }

  if (applyOutcome === 'apply_failed' || itemStatus === 'apply_failed') {
    return IMPORT_CANDIDATE_ADD_BLOCKER_CODES.ADD_FAILED;
  }

  if (applyOutcome === 'blocked' || itemStatus === 'blocked') {
    return IMPORT_CANDIDATE_ADD_BLOCKER_CODES.UNSAFE_ADD_PLAN;
  }

  return null;
}

/**
 * Produces a small, allow-listed explanation for a post-download quality
 * block. The diagnostic snapshot retains detailed evidence; Music Queue and
 * Activity receive only this non-sensitive category.
 */
export function deriveImportCandidateAddRecoveryReasonCode({
  addBlockerCode = null,
  qualityGate = null,
  recoveryReasonCode = null,
} = {}) {
  const normalizedAddBlockerCode = normalizeImportCandidateAddBlockerCode(addBlockerCode);
  if (normalizedAddBlockerCode !== IMPORT_CANDIDATE_ADD_BLOCKER_CODES.MEDIA_VERIFICATION) {
    return null;
  }

  const normalizedReasonCode = normalizeMusicQueueAddRecoveryReasonCode(recoveryReasonCode);
  if (normalizedReasonCode) {
    return normalizedReasonCode;
  }

  const blockerCodes = normalizeQualityGateBlockerCodes(qualityGate);
  if (blockerCodes.some((code) => SUSPICIOUS_LOSSLESS_BLOCKER_CODE_PATTERN.test(code))) {
    return MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.SUSPICIOUS_LOSSLESS;
  }

  if (blockerCodes.some((code) => LOSSY_AUDIO_BLOCKER_CODE_PATTERN.test(code))) {
    return MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.LOSSY_AUDIO;
  }

  return MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.AUDIO_CHECK_FAILED;
}
