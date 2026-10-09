/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { MAX_DOWNLOAD_ADOPTION_FILES } from './import-candidate-download-adoption-presentation.js';

export function buildImportCandidateDownloadOriginPresentation(review) {
  const verifiedFileCount = Number.isInteger(review?.verifiedFileCount) && review.verifiedFileCount > 0
    && review.verifiedFileCount <= MAX_DOWNLOAD_ADOPTION_FILES ? review.verifiedFileCount : 0;
  const retiredRequestCount = review?.retiredRequestCount === 1 ? 1 : 0;
  const reviewDigest = typeof review?.reviewDigest === 'string' ? review.reviewDigest.trim() : '';
  const canRestore = review?.canRestore === true && verifiedFileCount > 0 && retiredRequestCount === 1
    && reviewDigest.length > 0 && reviewDigest.length <= 4096;
  return { canRestore, verifiedFileCount, retiredRequestCount, reviewDigest: canRestore ? reviewDigest : null,
    explanation: canRestore
      ? 'The earlier request has verified downloads for its full saved file list. One newer request has not been sent.'
      : 'This download request cannot be resolved safely here. Review its current status before continuing.',
    confirmation: 'Stop only the unused newer request and continue tracking the verified existing downloads. Saved quality and library checks still apply.' };
}
