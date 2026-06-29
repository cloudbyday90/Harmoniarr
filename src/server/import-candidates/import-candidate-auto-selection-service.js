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
  DEFAULT_SELECTION_READINESS_POLICY,
  buildImportCandidateSelectionReadiness,
} from './import-candidate-selection-readiness.js';

export const DEFAULT_AUTO_SELECTION_REASON = 'High-confidence automatic selection';
const REVIEWABLE_STATUSES = new Set(['pending', 'held']);
const AUTO_DOWNLOAD_ELIGIBLE_QUALITY_CODES = new Set(['accepted']);

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function getCandidateCompositeScore(candidate) {
  return toNullableNumber(candidate?.normalizedPayload?.compositeScore);
}

function buildStatusCounts(candidates) {
  const counts = {};
  for (const candidate of candidates) {
    const status = typeof candidate?.status === 'string' ? candidate.status : '';
    if (!status) {
      continue;
    }

    counts[status] = (counts[status] ?? 0) + 1;
  }

  return counts;
}

function buildScoredCandidates(candidates) {
  return candidates
    .map((candidate) => ({
      candidate,
      score: getCandidateCompositeScore(candidate),
    }))
    .filter(({ score }) => score !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return String(left.candidate?.id ?? '').localeCompare(String(right.candidate?.id ?? ''));
    });
}

function resolveSkippedReasonForQuality(quality) {
  if (!quality) {
    return 'quality_not_evaluated';
  }

  if (quality.autoDownloadEligible === true || AUTO_DOWNLOAD_ELIGIBLE_QUALITY_CODES.has(quality.code)) {
    return null;
  }

  if (quality.code === 'below_minimum') return 'quality_below_minimum';
  if (quality.code === 'needs_verification') return 'quality_needs_verification';
  if (quality.code === 'no_evidence') return 'quality_no_evidence';
  return 'quality_not_eligible';
}

function evaluateCandidateQuality({
  candidate,
  profileCode,
  qualityOverride,
  qualityPolicyService,
}) {
  if (typeof qualityPolicyService?.evaluateQualityEvidence !== 'function') {
    return null;
  }

  return qualityPolicyService.evaluateQualityEvidence({
    candidate,
    profileCode,
    qualityOverride,
  });
}

function buildQualityEligibleCandidates({
  profileCode,
  qualityOverride,
  qualityPolicyService,
  scoredCandidates,
}) {
  if (typeof qualityPolicyService?.evaluateQualityEvidence !== 'function') {
    return {
      eligibleCandidates: scoredCandidates.map((entry) => ({
        ...entry,
        quality: null,
      })),
      latestQuality: null,
      latestSkippedReason: null,
      qualityGateApplied: false,
    };
  }

  const evaluatedCandidates = scoredCandidates.map((entry) => {
    const quality = evaluateCandidateQuality({
      candidate: entry.candidate,
      profileCode,
      qualityOverride,
      qualityPolicyService,
    });
    return {
      ...entry,
      quality,
      skippedReason: resolveSkippedReasonForQuality(quality),
    };
  });

  const eligibleCandidates = evaluatedCandidates
    .filter((entry) => entry.skippedReason === null);

  return {
    eligibleCandidates,
    latestQuality: evaluatedCandidates[0]?.quality ?? null,
    latestSkippedReason: evaluatedCandidates[0]?.skippedReason ?? null,
    qualityGateApplied: true,
  };
}

export function buildImportCandidateAutoSelectionEvaluation({
  candidates = [],
  policy = DEFAULT_SELECTION_READINESS_POLICY,
  profileCode = null,
  qualityOverride = null,
  qualityPolicyService = null,
} = {}) {
  const candidateList = Array.isArray(candidates) ? candidates : [];
  const scoredCandidates = buildScoredCandidates(candidateList);
  const qualityGate = buildQualityEligibleCandidates({
    profileCode,
    qualityOverride,
    qualityPolicyService,
    scoredCandidates,
  });
  const selectionCandidates = qualityGate.eligibleCandidates;
  const readiness = buildImportCandidateSelectionReadiness({
    bestCompositeScore: selectionCandidates[0]?.score ?? null,
    policy,
    scoredCandidateCount: selectionCandidates.length,
    secondBestCompositeScore: selectionCandidates[1]?.score ?? null,
    statusCounts: buildStatusCounts(candidateList),
    totalCount: candidateList.length,
  });

  return {
    bestCandidate: selectionCandidates[0]?.candidate ?? null,
    candidateCount: candidateList.length,
    quality: selectionCandidates[0]?.quality ?? qualityGate.latestQuality,
    qualityGateApplied: qualityGate.qualityGateApplied,
    readiness,
    scoredCandidateCount: selectionCandidates.length,
    skippedReason: selectionCandidates.length > 0 ? null : qualityGate.latestSkippedReason,
  };
}

export function createImportCandidateAutoSelectionService({
  listImportCandidates,
  policy = DEFAULT_SELECTION_READINESS_POLICY,
  qualityPolicyService = null,
  selectImportCandidate,
  selectionReason = DEFAULT_AUTO_SELECTION_REASON,
} = {}) {
  async function selectHighConfidenceCandidate({
    actorUserId = null,
    profileCode = null,
    qualityOverride = null,
    requestMetadata = null,
    sourceSearchId,
  } = {}) {
    const normalizedSourceSearchId = typeof sourceSearchId === 'string' ? sourceSearchId.trim() : '';
    if (!normalizedSourceSearchId) {
      return {
        attempted: false,
        selected: false,
        skippedReason: 'missing_source_search_id',
      };
    }

    if (typeof listImportCandidates !== 'function' || typeof selectImportCandidate !== 'function') {
      return {
        attempted: false,
        selected: false,
        skippedReason: 'auto_selection_unavailable',
        sourceSearchId: normalizedSourceSearchId,
      };
    }

    const listResult = await listImportCandidates({
      limit: 100,
      offset: 0,
      sourceSearchId: normalizedSourceSearchId,
    });
    const candidates = Array.isArray(listResult?.candidates) ? listResult.candidates : [];
    const evaluation = buildImportCandidateAutoSelectionEvaluation({
      candidates,
      policy,
      profileCode,
      qualityOverride,
      qualityPolicyService,
    });
    const readiness = evaluation.readiness;

    if (evaluation.qualityGateApplied && evaluation.skippedReason) {
      return {
        attempted: true,
        candidateCount: evaluation.candidateCount,
        quality: evaluation.quality,
        readiness,
        scoredCandidateCount: evaluation.scoredCandidateCount,
        selected: false,
        skippedReason: evaluation.skippedReason,
        sourceSearchId: normalizedSourceSearchId,
      };
    }

    if (readiness?.code !== 'auto_selectable') {
      return {
        attempted: true,
        candidateCount: evaluation.candidateCount,
        quality: evaluation.quality,
        readiness,
        scoredCandidateCount: evaluation.scoredCandidateCount,
        selected: false,
        skippedReason: readiness?.code ?? 'no_candidates',
        sourceSearchId: normalizedSourceSearchId,
      };
    }

    const bestCandidate = evaluation.bestCandidate;
    if (!bestCandidate?.id || !REVIEWABLE_STATUSES.has(bestCandidate.status)) {
      return {
        attempted: true,
        candidateCount: evaluation.candidateCount,
        readiness,
        scoredCandidateCount: evaluation.scoredCandidateCount,
        selected: false,
        skippedReason: 'best_candidate_not_reviewable',
        sourceSearchId: normalizedSourceSearchId,
      };
    }

    await selectImportCandidate({
      actorUserId,
      importCandidateId: bestCandidate.id,
      reason: selectionReason,
      requestMetadata,
    });

    return {
      attempted: true,
      candidateCount: evaluation.candidateCount,
      quality: evaluation.quality,
      readiness,
      scoredCandidateCount: evaluation.scoredCandidateCount,
      selected: true,
      selectedCandidateId: bestCandidate.id,
      sourceSearchId: normalizedSourceSearchId,
    };
  }

  return {
    selectHighConfidenceCandidate,
  };
}
