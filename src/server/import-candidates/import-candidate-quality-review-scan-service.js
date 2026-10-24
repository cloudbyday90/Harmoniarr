/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import { QUALITY_REVIEW_CANDIDATE_PAGE_SIZE } from './import-candidate-quality-review-candidate-store.js';

export const QUALITY_REVIEW_DETAIL_SCAN_LIMIT = 200;

/** Read budgets bound fetched facts as well as evaluations; EOF is explicit. */
export function createQualityReviewScanService({ candidateStore, isEligible }) {
  return async function scanCandidates(scope, { limit, anchor = null, direction = 'next', inclusive = false, queryable = null,
    lockRows = queryable != null } = {}) {
    let afterId = anchor; let firstId = null; let checkedCount = 0; let fetchedCount = 0; let pageReads = 0;
    const candidates = [];
    const result = exhausted => ({ candidates, exhausted, afterId, firstId, checkedCount, fetchedCount, pageReads });
    while (fetchedCount + QUALITY_REVIEW_CANDIDATE_PAGE_SIZE <= QUALITY_REVIEW_DETAIL_SCAN_LIMIT) {
      const page = await candidateStore.listCandidatePage({ sourceSearchId: scope.failedCandidate.sourceSearchId, afterId,
        direction, inclusive: pageReads === 0 && inclusive, queryable, lockRows });
      pageReads++; fetchedCount += page.length;
      for (const candidate of page) {
        firstId ??= candidate.id;
        afterId = candidate.id; checkedCount++;
        if (isEligible(candidate, scope)) candidates.push(candidate);
        if (candidates.length === limit) return result(false);
      }
      if (page.length < QUALITY_REVIEW_CANDIDATE_PAGE_SIZE) return result(true);
    }
    return result(false);
  };
}
