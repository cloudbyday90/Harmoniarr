/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const messages = new Map([
  ['external_request_discovery_no_candidates', 'The provider completed this search without results. Review the search policy before choosing Search again.'],
  ['slskd_search_continuation_expired', 'The saved search expired. Choose Search again to request a new search for this approved release.'],
  ['slskd_search_continuation_unavailable', 'The saved search is no longer available. Choose Search again to request a new search for this approved release.'],
]);

export function getExternalSearchRecoveryMessage(code) {
  return messages.get(code) ?? null;
}

export function canRecoverExternalSearchRun(run) {
  return run?.operationType === 'library_external_request_discovery' && run.status === 'failed'
    && run.summary?.externalSearchSuperseded !== true
    && (run.summary?.failureCode !== 'external_request_discovery_no_candidates'
      || (run.summary?.searchOutcome === 'published_empty' && run.summary?.candidateCount === 0))
    && getExternalSearchRecoveryMessage(run.summary?.failureCode) !== null;
}
