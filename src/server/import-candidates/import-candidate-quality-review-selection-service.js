/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { createImportCandidateQualityReviewScopeService } from './import-candidate-quality-review-scope-service.js';

export function createImportCandidateQualityReviewSelectionService({ selectImportCandidate,
  scopeService = null, ...scopeDependencies } = {}) {
  if (typeof selectImportCandidate !== 'function') throw new TypeError('Quality-review selection requires selectImportCandidate');
  const scope = scopeService ?? createImportCandidateQualityReviewScopeService(scopeDependencies);
  async function selectQualityReviewMatch({ actorUserId, appUserId, wantedReleaseId, importCandidateId,
    eventDetails = null, requestMetadata = null }) {
    return scope.withCurrentScope({ actorUserId, appUserId, wantedReleaseId, importCandidateId }, async ({ scope: current, queryable }) => {
      if (!scope.isEligible(await scope.readCandidate(importCandidateId, queryable), current)) {
        throw createApiError(409, 'missing_music_match_changed', 'Available matches have changed. Refresh this release before choosing another match.');
      }
      return selectImportCandidate({ actorUserId, eventDetails, importCandidateId, requestMetadata, queryable,
        reason: 'Selected another match after measured quality review' });
    });
  }
  return { listQualityReviewMatchIds: scope.listQualityReviewMatchIds, selectQualityReviewMatch };
}
