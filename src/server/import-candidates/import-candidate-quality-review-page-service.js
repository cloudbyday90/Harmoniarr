/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import { qualityReviewCursorContext, qualityReviewCursorChanged, QUALITY_REVIEW_MATCH_PAGE_SIZE } from './import-candidate-quality-review-cursor-policy.js';

export function createQualityReviewPageService({ readScope, scanCandidates, cursorPolicy, revisionStore }) {
  return async function getQualityReviewAlternatives(input) {
    const scope = await readScope(input);
    if (!scope) {
      if (input.matchCursor != null) throw qualityReviewCursorChanged();
      return { candidates: [], canSearchAgain: false };
    }
    const revisionInput = { sourceSearchId: scope.failedCandidate.sourceSearchId };
    const revision = await revisionStore.readRevision(revisionInput);
    if (!revision) throw qualityReviewCursorChanged();
    const context = qualityReviewCursorContext(input, scope, revision);
    const { anchor, direction, emptyFromStart, inclusive } = cursorPolicy.decode(input.matchCursor, context);
    const scan = await scanCandidates(scope, { limit: QUALITY_REVIEW_MATCH_PAGE_SIZE + 1, anchor, direction, inclusive });
    if (await revisionStore.readRevision(revisionInput) !== revision) throw qualityReviewCursorChanged();
    const hasMore = scan.candidates.length > QUALITY_REVIEW_MATCH_PAGE_SIZE;
    const scanIncomplete = !hasMore && !scan.exhausted;
    const candidates = scan.candidates.slice(0, QUALITY_REVIEW_MATCH_PAGE_SIZE);
    if (direction === 'previous') candidates.reverse();
    const emptyWalk = emptyFromStart && scan.candidates.length === 0 && direction === 'next';
    const encode = (boundary, nextDirection, empty = false, includeBoundary = false) => cursorPolicy.encode({ anchor: boundary,
      direction: nextDirection, context, emptyFromStart: empty, inclusive: includeBoundary });
    const first = candidates[0]?.id ?? scan.firstId ?? anchor;
    const last = candidates.at(-1)?.id ?? scan.firstId ?? anchor;
    let previousCursor = null; let nextCursor = null;
    if (direction === 'next') {
      if (anchor) previousCursor = encode(first, 'previous', false, scan.firstId == null);
      if (hasMore) nextCursor = encode(last, 'next');
      else if (scanIncomplete) nextCursor = encode(scan.afterId, 'next', emptyWalk);
    } else {
      if (anchor) nextCursor = encode(last, 'next', false, scan.firstId == null);
      if (hasMore) previousCursor = encode(first, 'previous');
      else if (scanIncomplete) previousCursor = encode(scan.afterId, 'previous');
    }
    return { candidates, canSearchAgain: emptyWalk && scan.exhausted,
      ...(candidates.length || anchor || scanIncomplete ? { matchChoicePage: {
        previousCursor, nextCursor, scanIncomplete, scanDirection: direction, canReturnToFirst: anchor != null,
      } } : {}),
    };
  };
}
