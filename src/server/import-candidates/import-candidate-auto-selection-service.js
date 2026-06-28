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

export function buildImportCandidateAutoSelectionEvaluation({
  candidates = [],
  policy = DEFAULT_SELECTION_READINESS_POLICY,
} = {}) {
  const candidateList = Array.isArray(candidates) ? candidates : [];
  const scoredCandidates = buildScoredCandidates(candidateList);
  const readiness = buildImportCandidateSelectionReadiness({
    bestCompositeScore: scoredCandidates[0]?.score ?? null,
    policy,
    scoredCandidateCount: scoredCandidates.length,
    secondBestCompositeScore: scoredCandidates[1]?.score ?? null,
    statusCounts: buildStatusCounts(candidateList),
    totalCount: candidateList.length,
  });

  return {
    bestCandidate: scoredCandidates[0]?.candidate ?? null,
    candidateCount: candidateList.length,
    readiness,
    scoredCandidateCount: scoredCandidates.length,
  };
}

export function createImportCandidateAutoSelectionService({
  listImportCandidates,
  policy = DEFAULT_SELECTION_READINESS_POLICY,
  selectImportCandidate,
  selectionReason = DEFAULT_AUTO_SELECTION_REASON,
} = {}) {
  async function selectHighConfidenceCandidate({
    actorUserId = null,
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
    const evaluation = buildImportCandidateAutoSelectionEvaluation({ candidates, policy });
    const readiness = evaluation.readiness;

    if (readiness?.code !== 'auto_selectable') {
      return {
        attempted: true,
        candidateCount: evaluation.candidateCount,
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
