/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { projectSlskdSearchDiagnostics } from '../../shared/slskd-search-diagnostics.js';

export function buildMissingMusicSearchDiagnostics(release) {
  const request = release?.discoveryRequest;
  const evidence = request?.evidence;
  const result = evidence?.lastSearchResult;
  if (!['cooldown', 'blocked'].includes(request?.requestStatus) || evidence?.lastDispatchFailure
    || evidence?.searchContinuation || result?.sourceProvider !== 'slskd'
    || result.candidateCount !== 0 || result.fileCount !== 0) return null;
  return projectSlskdSearchDiagnostics(result.ingestionDiagnostics);
}

// Review capabilities describe navigation only. Destination endpoints retain
// independent administrator/fresh-session/CSRF enforcement for their operations.
export function buildMissingMusicSearchCorrectionPermissions({ actorUser, targetUser, searchDiagnostics } = {}) {
  const data = projectSlskdSearchDiagnostics(searchDiagnostics);
  const canReview = actorUser?.role === 'admin' && targetUser?.accountStatus === 'active' && data !== null;
  return {
    canReviewIgnoredSources: canReview && data.ignoredUserResponseCount > 0,
    canReviewProviderConnection: canReview && (data.malformedFileCount > 0 || data.missingUsernameResponseCount > 0),
  };
}
