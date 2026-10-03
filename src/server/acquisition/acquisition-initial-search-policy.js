/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { parseMetadataReleaseDateInstant } from '../metadata/metadata-release-date-normalization.js';

const PRIOR_SEARCH_KEYS = ['lastSearchId', 'lastSearchResult', 'lastSearchQuery', 'lastSearchAttemptCount',
  'lastDispatchFailure', 'lastDispatchAttemptedAt', 'searchExhausted', 'musicQueueRediscovery',
  'downloadRecoveryRediscovery', 'downloadRecoveryExhausted', 'musicQueueQualityOverride'];

export function hasRecordedInitialSearchIntent(release) {
  const intent = release?.discoveryInitialSearch;
  return intent?.wantedReleaseId === release?.id && typeof intent?.requestedAt === 'string'
    && Number.isFinite(Date.parse(intent.requestedAt));
}

export function hasQueuedAutomaticSearch(release) {
  return release?.discoveryRequest?.searchMode === 'automatic'
    && release.discoveryRequest.requestStatus === 'ready' && release.discoveryRequest.blockedReason == null;
}

export function canFindInitialMusicMatches({ release, targetUser, now = new Date(), projectedRelease = null } = {}) {
  const request = release?.discoveryRequest;
  if (!targetUser || targetUser.isDisabled === true || targetUser.accountStatus === 'disabled'
    || !['missing', 'partial'].includes(release?.wantedStatus) || !(release.missingTrackCount > 0)
    || release.visibilityState === 'ignored' || release.discoveryLinkExists !== true
    || release.hasPriorDiscoveryCandidates !== false || release.discoveryInitialSearch != null
    || !hasQueuedAutomaticSearch(release) || request.searchAttemptCount !== 0 || request.researchAttemptCount !== 0
    || request.lastSearchAt != null || request.manualRequestedAt != null
    || release.discoveryQualityOverride != null) return false;
  const evidence = request.evidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
    || PRIOR_SEARCH_KEYS.some((key) => evidence[key] != null)) return false;
  const instant = now instanceof Date ? now.getTime() : NaN;
  if (!Number.isFinite(instant)) return false;
  if (request.nextSearchAfter != null && (!Number.isFinite(Date.parse(request.nextSearchAfter))
    || Date.parse(request.nextSearchAfter) > instant)) return false;
  if (release.releaseDate != null) {
    const releaseDate = parseMetadataReleaseDateInstant(release.releaseDate);
    if (!releaseDate || releaseDate.getTime() > instant) return false;
  }
  if (projectedRelease && projectedRelease.status?.code !== 'queued_for_search') return false;
  const review = request.importReviewSummary;
  return !(review?.totalCount > 0) && !(review?.confirmedTransferSummary?.transferCount > 0)
    && !(review?.downloadExecutionSummary?.totalItemCount > 0) && !(review?.libraryAddSummary?.totalItemCount > 0);
}
