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

export const DEFAULT_SELECTION_READINESS_POLICY = Object.freeze({
  ambiguityMargin: 5,
  minCompositeScore: 85,
});

function toCount(value) {
  return Number.parseInt(String(value ?? 0), 10) || 0;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function getStatusCount(statusCounts, status) {
  return toCount(statusCounts?.[status]);
}

export function buildImportCandidateSelectionReadiness({
  bestCompositeScore = null,
  policy = DEFAULT_SELECTION_READINESS_POLICY,
  scoredCandidateCount = 0,
  secondBestCompositeScore = null,
  statusCounts = {},
  totalCount = 0,
} = {}) {
  const candidateCount = toCount(totalCount);
  if (candidateCount < 1) {
    return null;
  }

  const selectedCount = getStatusCount(statusCounts, 'selected');
  const downloadingCount = getStatusCount(statusCounts, 'downloading');
  const importPendingCount = getStatusCount(statusCounts, 'import_pending');
  const activeHandoffCount = downloadingCount + importPendingCount;
  const reviewableCount = getStatusCount(statusCounts, 'pending') + getStatusCount(statusCounts, 'held');
  const bestScore = toNullableNumber(bestCompositeScore);
  const secondScore = toNullableNumber(secondBestCompositeScore);
  const scoreGap = bestScore !== null && secondScore !== null
    ? Number((bestScore - secondScore).toFixed(2))
    : null;
  const minCompositeScore = toNullableNumber(policy?.minCompositeScore)
    ?? DEFAULT_SELECTION_READINESS_POLICY.minCompositeScore;
  const ambiguityMargin = toNullableNumber(policy?.ambiguityMargin)
    ?? DEFAULT_SELECTION_READINESS_POLICY.ambiguityMargin;
  const thresholds = {
    ambiguityMargin,
    minCompositeScore,
  };

  if (activeHandoffCount > 0) {
    return {
      bestCompositeScore: bestScore,
      candidateCount,
      code: 'handoff_active',
      label: 'Download handoff active',
      message: 'A selected candidate is already moving through the download or import pipeline.',
      reviewableCount,
      scoredCandidateCount: toCount(scoredCandidateCount),
      scoreGap,
      secondBestCompositeScore: secondScore,
      thresholds,
      tone: 'info',
    };
  }

  if (selectedCount > 0) {
    return {
      bestCompositeScore: bestScore,
      candidateCount,
      code: 'selected',
      label: 'Candidate selected',
      message: 'A candidate is selected; the download worker is responsible for enqueueing it next.',
      reviewableCount,
      scoredCandidateCount: toCount(scoredCandidateCount),
      scoreGap,
      secondBestCompositeScore: secondScore,
      thresholds,
      tone: 'info',
    };
  }

  if (reviewableCount < 1) {
    return {
      bestCompositeScore: bestScore,
      candidateCount,
      code: 'not_reviewable',
      label: 'No reviewable candidates',
      message: 'Candidates exist, but none are pending or held for selection.',
      reviewableCount,
      scoredCandidateCount: toCount(scoredCandidateCount),
      scoreGap,
      secondBestCompositeScore: secondScore,
      thresholds,
      tone: 'warning',
    };
  }

  if (bestScore === null) {
    return {
      bestCompositeScore: null,
      candidateCount,
      code: 'unscored',
      label: 'Needs review',
      message: 'Candidates need manual review because no composite score is available.',
      reviewableCount,
      scoredCandidateCount: toCount(scoredCandidateCount),
      scoreGap: null,
      secondBestCompositeScore: secondScore,
      thresholds,
      tone: 'warning',
    };
  }

  if (bestScore < minCompositeScore) {
    return {
      bestCompositeScore: bestScore,
      candidateCount,
      code: 'low_confidence',
      label: 'Needs review',
      message: 'The best candidate is below the high-confidence selection threshold.',
      reviewableCount,
      scoredCandidateCount: toCount(scoredCandidateCount),
      scoreGap,
      secondBestCompositeScore: secondScore,
      thresholds,
      tone: 'warning',
    };
  }

  if (scoreGap !== null && scoreGap < ambiguityMargin) {
    return {
      bestCompositeScore: bestScore,
      candidateCount,
      code: 'ambiguous',
      label: 'Manual review recommended',
      message: 'Multiple candidates are close enough in score that an operator should choose before download handoff.',
      reviewableCount,
      scoredCandidateCount: toCount(scoredCandidateCount),
      scoreGap,
      secondBestCompositeScore: secondScore,
      thresholds,
      tone: 'warning',
    };
  }

  return {
    bestCompositeScore: bestScore,
    candidateCount,
    code: 'auto_selectable',
    label: 'High-confidence candidate',
    message: 'The best candidate meets selection thresholds. Review and select it to start download handoff.',
    reviewableCount,
    scoredCandidateCount: toCount(scoredCandidateCount),
    scoreGap,
    secondBestCompositeScore: secondScore,
    thresholds,
    tone: 'info',
  };
}
