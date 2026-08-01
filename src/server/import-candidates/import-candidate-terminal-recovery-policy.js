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
  IMPORT_CANDIDATE_ADD_BLOCKER_CODES,
  normalizeImportCandidateAddBlockerCode,
} from './import-candidate-add-blocker.js';
import { MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES } from '../../shared/music-queue-add-recovery-presentation.js';

export const TERMINAL_MATCH_OUTCOME_CODES = Object.freeze({
  DOWNLOAD_FAILED: 'download_failed',
  DOWNLOAD_TIMED_OUT: 'download_timed_out',
  IMPORT_BLOCKED: 'import_blocked',
  QUALITY_FAILED: 'quality_failed',
  SOURCE_DISAPPEARED: 'source_disappeared',
});

const TIMED_OUT_TRANSFER_TOKENS = ['timedout', 'timed out', 'timeout'];
const MEDIA_TOOLING_UNAVAILABLE_WARNING_CODE = 'media_inspection_unavailable';

function normalizeToken(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function hasTimedOutTransfer(liveTransfers) {
  if (!Array.isArray(liveTransfers)) {
    return false;
  }

  return liveTransfers.some((transfer) => {
    const state = normalizeToken(transfer?.state);
    const exception = normalizeToken(transfer?.exception);
    return TIMED_OUT_TRANSFER_TOKENS.some((token) => state.includes(token) || exception.includes(token));
  });
}

function hasMediaToolingUnavailableWarning(applyPreview) {
  const inspectionWarnings = [
    ...(Array.isArray(applyPreview?.inspectionWarnings) ? applyPreview.inspectionWarnings : []),
    ...(Array.isArray(applyPreview?.files)
      ? applyPreview.files.flatMap((file) => file?.inspection?.warnings ?? [])
      : []),
  ];

  return inspectionWarnings.some((warning) => (
    warning?.code === MEDIA_TOOLING_UNAVAILABLE_WARNING_CODE
  ));
}

/**
 * Classifies the terminal provider observation without exposing provider
 * messages to Music Queue. The raw observation remains in run diagnostics.
 */
export function deriveTerminalTransferOutcome({
  liveTransferSummary = null,
  liveTransfers = [],
} = {}) {
  if (liveTransferSummary?.status === 'not_found'
    && liveTransferSummary?.missingTransfer?.isPastGracePeriod === true) {
    return TERMINAL_MATCH_OUTCOME_CODES.SOURCE_DISAPPEARED;
  }

  if (liveTransferSummary?.status !== 'failed') {
    return null;
  }

  return hasTimedOutTransfer(liveTransfers)
    ? TERMINAL_MATCH_OUTCOME_CODES.DOWNLOAD_TIMED_OUT
    : TERMINAL_MATCH_OUTCOME_CODES.DOWNLOAD_FAILED;
}

/**
 * An import blocker is not automatically recoverable by default. A missing
 * completed-download source is the narrow exception: selecting another remote
 * match starts from a fresh download and cannot overwrite or modify the
 * library. Collisions, policy blockers, and path validation failures may be
 * release- or environment-wide, so automatic fallback would be unsafe.
 */
export function evaluateImportBlockerRecovery(applyPreview = {}) {
  if (applyPreview?.summary?.status === 'attention'
    && hasMediaToolingUnavailableWarning(applyPreview)) {
    return {
      addBlockerCode: IMPORT_CANDIDATE_ADD_BLOCKER_CODES.MEDIA_VERIFICATION,
      canRecover: false,
      outcomeCode: TERMINAL_MATCH_OUTCOME_CODES.IMPORT_BLOCKED,
      recoveryReasonCode: MUSIC_QUEUE_ADD_RECOVERY_REASON_CODES.AUDIO_CHECK_FAILED,
      requiresOperator: false,
      skippedReason: 'media_tooling_unavailable',
    };
  }

  if (applyPreview?.summary?.status !== 'blocked') {
    return {
      addBlockerCode: null,
      canRecover: false,
      outcomeCode: null,
      requiresOperator: false,
    };
  }

  const counts = applyPreview?.counts ?? {};
  const validationBlockerCount = Array.isArray(applyPreview?.preview?.validation?.blockers)
    ? applyPreview.preview.validation.blockers.length
    : 0;
  const missingSourceCount = Number(counts.missingSourceCount ?? 0);
  const hasOnlyMissingSources = missingSourceCount > 0
    && Number(counts.collisionCount ?? 0) === 0
    && Number(counts.lossyDecisionRequiredCount ?? 0) === 0
    && validationBlockerCount === 0;

  if (hasOnlyMissingSources) {
    return {
      addBlockerCode: IMPORT_CANDIDATE_ADD_BLOCKER_CODES.SOURCE_PATH_UNAVAILABLE,
      canRecover: true,
      outcomeCode: TERMINAL_MATCH_OUTCOME_CODES.SOURCE_DISAPPEARED,
      requiresOperator: false,
    };
  }

  return {
    addBlockerCode: normalizeImportCandidateAddBlockerCode(applyPreview?.summary?.blockerCode)
      ?? IMPORT_CANDIDATE_ADD_BLOCKER_CODES.UNSAFE_ADD_PLAN,
    canRecover: false,
    outcomeCode: TERMINAL_MATCH_OUTCOME_CODES.IMPORT_BLOCKED,
    requiresOperator: true,
  };
}
