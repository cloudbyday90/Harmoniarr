/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

export function createLibraryDiscoverySearchService({ continuationService, authorityStore, getNow = () => new Date() }) {
  async function startSearch({ claimedRequest, query, context, assertCurrent }) {
    return continuationService.getOrStartSearch({
      owner: { discoveryRequestId: claimedRequest.discoveryRequestId }, query,
      context: { ...context, searchAttemptCount: claimedRequest.searchAttemptCount,
        previousSearchId: claimedRequest.evidence?.lastSearchId ?? null,
        rediscovery: claimedRequest.evidence?.musicQueueRediscovery ?? null,
        recoveryRetry: claimedRequest.evidence?.downloadRecoveryRetry ?? null,
        scopedRunId: claimedRequest.evidence?.downloadRecoveryRediscovery?.owningRunId ?? null },
      onReservation: context.purpose === 'track_fallback' ? null : ({ queryable, searchId }) => authorityStore.deferContinuation({
        queryable, searchId, claimedRequest, nextSearchAfter: new Date(getNow().getTime() + 30_000).toISOString(),
      }),
      assertCurrent: async (input = {}) => {
        await assertCurrent(input);
        await authorityStore.assertClaimCurrent({ claimedRequest, ...input });
      },
    });
  }
  return { startSearch };
}
