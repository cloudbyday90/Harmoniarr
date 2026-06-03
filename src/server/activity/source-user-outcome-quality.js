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

// Pure classifier that maps an import-apply outcome into a quality-weighted
// delivery evidence descriptor. A successful apply is not binary: a partially
// applied folder, a transcode preflight that failed/was unavailable, or skipped
// files all represent degraded delivery even though the candidate transitioned
// to "applied". This module derives a 0..1 quality weight (and an explainable
// label) from the apply summary so the reputation ledger can record fidelity,
// not just completion. It performs no IO and has no side effects.

const DEFAULT_QUALITY_WEIGHT = 1;
// A degraded-but-applied outcome never scores below this floor: the files did
// land in the library, so the peer still delivered *something* usable. This
// prevents a single warning from being treated as a hard failure.
const MIN_DEGRADED_QUALITY_WEIGHT = 0.25;

function toNonNegativeInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.floor(parsed);
}

/**
 * Clamps a quality weight into the [0, 1] unit interval, defaulting to a clean
 * full-quality success for non-finite input.
 *
 * @param {*} value
 * @returns {number}
 */
export function normalizeQualityWeight(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_QUALITY_WEIGHT;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > 1) {
    return 1;
  }
  return parsed;
}

/**
 * Classifies an import-apply result into a quality-weighted success descriptor.
 *
 * This is only ever called for *applied* candidates (apply failures are
 * recorded separately as binary failures), so the outcome is always 'success';
 * the quality weight expresses how complete/clean that success was.
 *
 * @param {object} [params]
 * @param {string} [params.status] item status ('applied' | 'applied_with_warnings')
 * @param {object} [params.summary] apply summary counts
 * @param {number} [params.summary.appliedFileCount]
 * @param {number} [params.summary.failedFileCount]
 * @param {number} [params.summary.notAttemptedCount]
 * @param {number} [params.summary.skippedFileCount]
 * @param {number} [params.summary.totalFiles]
 * @param {number} [params.summary.transcodePreflightFailedCount]
 * @param {number} [params.summary.transcodePreflightUnavailableCount]
 * @returns {{ outcome: 'success', qualityWeight: number, qualityLabel: string, reason: string|null }}
 */
export function classifyApplyOutcomeQuality({ status = null, summary = null } = {}) {
  const safeSummary = summary && typeof summary === 'object' ? summary : {};

  const appliedFileCount = toNonNegativeInteger(safeSummary.appliedFileCount);
  const failedFileCount = toNonNegativeInteger(safeSummary.failedFileCount);
  const notAttemptedCount = toNonNegativeInteger(safeSummary.notAttemptedCount);
  const skippedFileCount = toNonNegativeInteger(safeSummary.skippedFileCount);
  const transcodeFailedCount = toNonNegativeInteger(safeSummary.transcodePreflightFailedCount);
  const transcodeUnavailableCount = toNonNegativeInteger(safeSummary.transcodePreflightUnavailableCount);

  const declaredTotal = toNonNegativeInteger(safeSummary.totalFiles);
  const inferredTotal = appliedFileCount + failedFileCount + notAttemptedCount + skippedFileCount;
  const totalFiles = Math.max(declaredTotal, inferredTotal);

  // Clean apply: every file landed and no warnings were flagged.
  const hasWarnings = status === 'applied_with_warnings'
    || failedFileCount > 0
    || notAttemptedCount > 0
    || skippedFileCount > 0
    || transcodeFailedCount > 0
    || transcodeUnavailableCount > 0;

  if (!hasWarnings) {
    return {
      outcome: 'success',
      qualityWeight: DEFAULT_QUALITY_WEIGHT,
      qualityLabel: 'clean',
      reason: null,
    };
  }

  // Completion ratio: how much of the expected payload actually applied.
  const completionRatio = totalFiles > 0
    ? appliedFileCount / totalFiles
    : (appliedFileCount > 0 ? 1 : 0);

  // Transcode preflight problems degrade fidelity even when the file applied,
  // because the delivered encoding could not be verified/normalized.
  const transcodePenalty = (transcodeFailedCount + transcodeUnavailableCount) > 0 ? 0.2 : 0;

  const rawQuality = completionRatio - transcodePenalty;
  const qualityWeight = normalizeQualityWeight(
    Math.max(MIN_DEGRADED_QUALITY_WEIGHT, rawQuality),
  );

  let qualityLabel = 'partial_apply';
  if (completionRatio >= 1 && (transcodeFailedCount + transcodeUnavailableCount) > 0) {
    qualityLabel = 'transcode_warning';
  } else if (completionRatio >= 1 && skippedFileCount > 0) {
    qualityLabel = 'skipped_files';
  }

  const appliedPercent = Math.round(completionRatio * 100);
  const reasonParts = [`${appliedFileCount} of ${totalFiles || appliedFileCount} files applied (${appliedPercent}%)`];
  if ((transcodeFailedCount + transcodeUnavailableCount) > 0) {
    reasonParts.push('transcode preflight warnings present');
  }
  if (skippedFileCount > 0) {
    reasonParts.push(`${skippedFileCount} skipped`);
  }

  return {
    outcome: 'success',
    qualityWeight,
    qualityLabel,
    reason: reasonParts.join('; '),
  };
}
