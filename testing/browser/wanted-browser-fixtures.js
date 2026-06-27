/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const wantedReleases = Object.freeze([
  Object.freeze({
    artistName: 'Autechre',
    artistSortName: 'autechre',
    expectedTrackCount: 10,
    id: 'wanted-amber',
    matchedTrackCount: 0,
    metadataArtistId: 'metadata-artist-autechre',
    metadataReleaseGroupId: 'metadata-rg-amber',
    metadataReleaseId: 'metadata-release-amber',
    missingTrackCount: 10,
    musicbrainzReleaseGroupId: 'mb-rg-amber',
    musicbrainzReleaseId: 'mb-release-amber',
    releaseDate: '1994-11-07',
    releaseDisambiguation: null,
    releaseGroupTitle: 'Amber',
    releaseGroupType: 'Album',
    releaseStatus: 'Official',
    releaseTitle: 'Amber',
    wantedStatus: 'missing',
  }),
  Object.freeze({
    artistName: 'Boards of Canada',
    artistSortName: 'boards of canada',
    discoveryRequest: {
      blockedReason: 'download_recovery_exhausted',
      evidence: {
        downloadRecoveryExhausted: {
          maxResearchAttemptCount: 3,
          sourceSearchId: 'search-mhtrtc-1',
          triggeredByFailedCandidateId: 'candidate-mhtrtc-failed-1',
        },
      },
      lastSearchAt: '2026-06-20T15:30:00.000Z',
      requestStatus: 'blocked',
      researchAttemptCount: 3,
      searchAttemptCount: 5,
    },
    expectedTrackCount: 17,
    id: 'wanted-mhtrtc',
    matchedTrackCount: 6,
    metadataArtistId: 'metadata-artist-boards',
    metadataReleaseGroupId: 'metadata-rg-mhtrtc',
    metadataReleaseId: 'metadata-release-mhtrtc',
    missingTrackCount: 11,
    musicbrainzReleaseGroupId: 'mb-rg-mhtrtc',
    musicbrainzReleaseId: 'mb-release-mhtrtc',
    releaseDate: '1998-04-20',
    releaseDisambiguation: null,
    releaseGroupTitle: 'Music Has the Right to Children',
    releaseGroupType: 'Album',
    releaseStatus: 'Official',
    releaseTitle: 'Music Has the Right to Children',
    wantedStatus: 'partial',
  }),
  Object.freeze({
    artistName: 'Radiohead',
    artistSortName: 'radiohead',
    expectedTrackCount: 11,
    id: 'wanted-kid-a',
    matchedTrackCount: 0,
    metadataArtistId: 'metadata-artist-radiohead',
    metadataReleaseGroupId: 'metadata-rg-kid-a',
    metadataReleaseId: 'metadata-release-kid-a',
    missingTrackCount: 11,
    musicbrainzReleaseGroupId: 'mb-rg-kid-a',
    musicbrainzReleaseId: 'mb-release-kid-a',
    releaseDate: '2000-10-02',
    releaseDisambiguation: null,
    releaseGroupTitle: 'Kid A',
    releaseGroupType: 'Album',
    releaseStatus: 'Official',
    releaseTitle: 'Kid A',
    wantedStatus: 'missing',
  }),
]);

const fixture = Object.freeze({
  reconciliationSummary: Object.freeze({
    fileCounts: Object.freeze({
      ambiguous: 0,
      ignored: 0,
      matched: 6,
      observed: 6,
      unmatched: 0,
    }),
    lastReconciledAt: '2026-06-20T16:00:00.000Z',
    releaseCounts: Object.freeze({
      complete: 0,
      duplicate: 0,
      partial: 1,
    }),
    summary: Object.freeze({
      message: '1 release is partially satisfied by the current library.',
      status: 'partial',
    }),
  }),
  wantedReleases,
  wantedSummary: Object.freeze({
    lastReconciledAt: '2026-06-20T16:00:00.000Z',
    monitoredArtistCount: 3,
    releaseCounts: Object.freeze({
      missing: 2,
      partial: 1,
      totalWanted: 3,
    }),
    summary: Object.freeze({
      message: '3 monitored releases still need files.',
      status: 'wanted',
    }),
  }),
});

export async function installWantedBrowserFixtures(browserContext) {
  await browserContext.addInitScript(({ fixturePayload }) => {
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.__harmoniarrWantedRetryRequests = [];

    function buildJsonResponse(body, status = 200) {
      return new Response(JSON.stringify(body), {
        headers: {
          'Content-Type': 'application/json',
        },
        status,
      });
    }

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    globalThis.fetch = async (input, init) => {
      const requestUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      const url = new URL(requestUrl, globalThis.location.origin);
      const method = String(
        init?.method
          ?? (typeof input === 'object' && input !== null && 'method' in input ? input.method : 'GET')
          ?? 'GET',
      ).toUpperCase();
      const path = url.pathname;

      if (method === 'GET' && path === '/api/v1/library/wanted-summary') {
        return buildJsonResponse(clone(fixturePayload.wantedSummary));
      }

      if (method === 'GET' && path === '/api/v1/library/reconciliation-summary') {
        return buildJsonResponse(clone(fixturePayload.reconciliationSummary));
      }

      if (method === 'GET' && path === '/api/v1/library/wanted-releases') {
        const statusFilter = url.searchParams.get('status');
        const filteredWantedReleases = clone(fixturePayload.wantedReleases)
          .filter((release) => (
            statusFilter === 'missing' || statusFilter === 'partial'
              ? release.wantedStatus === statusFilter
              : true
          ));

        return buildJsonResponse({
          ok: true,
          total: filteredWantedReleases.length,
          wantedReleases: filteredWantedReleases,
        });
      }

      const retryMatch = path.match(/^\/api\/v1\/library\/discovery-requests\/([^/]+)\/retry-download-recovery$/u);
      if (method === 'POST' && retryMatch) {
        globalThis.__harmoniarrWantedRetryRequests.push(decodeURIComponent(retryMatch[1]));
        return buildJsonResponse({
          dispatchAlreadyActive: false,
          ok: true,
        }, 202);
      }

      return originalFetch(input, init);
    };
  }, { fixturePayload: fixture });
}
