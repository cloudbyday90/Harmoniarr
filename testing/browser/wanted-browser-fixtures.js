/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildImportReviewCandidate,
  buildImportReviewPreview,
} from './import-review-browser-helpers.js';

const dispatchCandidate = buildImportReviewCandidate({
  fileCount: 10,
  files: [
    {
      bitRateKbps: 921,
      extension: 'flac',
      filename: '01 Foil.flac',
      folderPath: '/private/staging/Autechre/Amber',
      id: 'candidate-discovery-dispatch-file-1',
      isLocked: false,
      lengthSeconds: 397,
      sizeBytes: 54316224,
    },
  ],
  folderPath: '/private/staging/Autechre/Amber',
  id: 'candidate-discovery-dispatch',
  lockedFileCount: 0,
  normalizedPayload: {
    extensions: ['flac'],
  },
  sourceSearchId: 'search-discovery-dispatch-amber',
  selectionReason: 'operator_review',
  status: 'downloading',
  totalSizeBytes: 54316224,
  username: 'healthy-slskd-peer',
});

const selectionReadyCandidate = buildImportReviewCandidate({
  fileCount: 13,
  files: [
    {
      bitRateKbps: 921,
      extension: 'flac',
      filename: '01 Xtal.flac',
      folderPath: '/private/staging/Aphex Twin/Selected Ambient Works 85-92',
      id: 'candidate-selection-ready-file-1',
      isLocked: false,
      lengthSeconds: 293,
      sizeBytes: 41779200,
    },
  ],
  folderPath: '/private/staging/Aphex Twin/Selected Ambient Works 85-92',
  id: 'candidate-selection-ready',
  lockedFileCount: 0,
  normalizedPayload: {
    compositeScore: 91,
    extensions: ['flac'],
  },
  sourceSearchId: 'search-selection-ready-saw',
  selectionReason: 'operator_review',
  status: 'pending',
  totalSizeBytes: 41779200,
  username: 'high-confidence-peer',
});

const selectionComparisonCandidate = buildImportReviewCandidate({
  fileCount: 13,
  folderPath: '/private/staging/Aphex Twin/Selected Ambient Works 85-92 alternate',
  id: 'candidate-selection-comparison',
  lockedFileCount: 0,
  normalizedPayload: {
    compositeScore: 80,
    extensions: ['flac'],
  },
  sourceSearchId: 'search-selection-ready-saw',
  selectionReason: 'operator_review',
  status: 'pending',
  totalSizeBytes: 40777216,
  username: 'comparison-peer',
});

const wantedReleases = Object.freeze([
  Object.freeze({
    artistName: 'Autechre',
    artistSortName: 'autechre',
    discoveryRequest: {
      blockedReason: 'automatic_cooldown',
      evidence: {
        lastSearchAttemptCount: 1,
        lastSearchId: 'search-discovery-dispatch-amber',
        lastSearchResult: {
          candidateCount: 1,
          fileCount: 10,
          sourceProvider: 'slskd',
        },
      },
      lastSearchAt: '2026-06-27T21:02:00.000Z',
      importReviewSummary: {
        downloadExecutionSummary: {
          enqueuedTransferCount: 1,
          failedFilenameCount: 0,
          itemStatusCounts: {
            queued: 1,
          },
          latestItemStatus: 'queued',
          latestUpdatedAt: '2026-06-27T21:12:00.000Z',
          totalItemCount: 1,
        },
        latestStatus: 'downloading',
        latestUpdatedAt: '2026-06-27T21:10:00.000Z',
        statusCounts: {
          downloading: 1,
        },
        totalCount: 1,
      },
      nextSearchAfter: '2026-06-28T03:02:00.000Z',
      requestStatus: 'cooldown',
      researchAttemptCount: 0,
      searchAttemptCount: 1,
    },
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
    artistName: 'Aphex Twin',
    artistSortName: 'aphex twin',
    discoveryRequest: {
      blockedReason: 'automatic_cooldown',
      evidence: {
        lastSearchAttemptCount: 1,
        lastSearchId: 'search-selection-ready-saw',
        lastSearchResult: {
          candidateCount: 2,
          fileCount: 13,
          sourceProvider: 'slskd',
        },
      },
      importReviewSummary: {
        latestStatus: 'pending',
        latestUpdatedAt: '2026-06-27T21:18:00.000Z',
        selectionReadiness: {
          bestCompositeScore: 91,
          candidateCount: 2,
          code: 'auto_selectable',
          label: 'High-confidence candidate',
          message: 'The best candidate meets selection thresholds. Review and select it to start download handoff.',
          reviewableCount: 2,
          scoredCandidateCount: 2,
          scoreGap: 11,
          secondBestCompositeScore: 80,
          thresholds: {
            ambiguityMargin: 5,
            minCompositeScore: 85,
          },
          tone: 'info',
        },
        statusCounts: {
          pending: 2,
        },
        totalCount: 2,
      },
      lastSearchAt: '2026-06-27T21:15:00.000Z',
      nextSearchAfter: '2026-06-28T03:15:00.000Z',
      requestStatus: 'cooldown',
      researchAttemptCount: 0,
      searchAttemptCount: 1,
    },
    expectedTrackCount: 13,
    id: 'wanted-saw-85-92',
    matchedTrackCount: 0,
    metadataArtistId: 'metadata-artist-aphex',
    metadataReleaseGroupId: 'metadata-rg-saw-85-92',
    metadataReleaseId: 'metadata-release-saw-85-92',
    missingTrackCount: 13,
    musicbrainzReleaseGroupId: 'mb-rg-saw-85-92',
    musicbrainzReleaseId: 'mb-release-saw-85-92',
    releaseDate: '1992-02-12',
    releaseDisambiguation: null,
    releaseGroupTitle: 'Selected Ambient Works 85-92',
    releaseGroupType: 'Album',
    releaseStatus: 'Official',
    releaseTitle: 'Selected Ambient Works 85-92',
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
    discoveryRequest: {
      blockedReason: 'automatic_cooldown',
      evidence: {
        lastSearchAttemptCount: 2,
        lastSearchId: 'search-kid-a-zero',
        lastSearchResult: {
          candidateCount: 0,
          fileCount: 0,
          sourceProvider: 'slskd',
        },
      },
      lastSearchAt: '2026-06-27T20:30:00.000Z',
      nextSearchAfter: '2026-06-27T22:30:00.000Z',
      requestStatus: 'cooldown',
      researchAttemptCount: 0,
      searchAttemptCount: 2,
    },
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
  dispatchImportReviewWorkspace: Object.freeze({
    candidates: Object.freeze([
      dispatchCandidate,
      selectionReadyCandidate,
      selectionComparisonCandidate,
    ]),
    previewById: Object.freeze({
      [dispatchCandidate.id]: buildImportReviewPreview(dispatchCandidate),
      [selectionReadyCandidate.id]: buildImportReviewPreview(selectionReadyCandidate),
      [selectionComparisonCandidate.id]: buildImportReviewPreview(selectionComparisonCandidate),
    }),
  }),
  discoverySummary: Object.freeze({
    checkedAt: '2026-06-27T21:00:00.000Z',
    heartbeat: Object.freeze({
      intervalLabel: '15 minutes',
      intervalMs: 900000,
      mode: 'automatic',
      source: 'default',
      state: Object.freeze({
        lastErrorMessage: null,
        lastFinishedAt: '2026-06-27T20:45:00.000Z',
        lastOutcome: 'skipped',
        lastRunId: null,
        lastSkipReason: 'not_due',
        paused: false,
      }),
    }),
    lastEvaluatedAt: '2026-06-27T20:55:00.000Z',
    latestRun: null,
    nextEligibleAt: '2026-06-28T00:55:00.000Z',
    requestCounts: Object.freeze({
      blocked: 0,
      cooldown: 1,
      ready: 2,
      totalRequests: 3,
    }),
    summary: Object.freeze({
      message: '2 discovery requests are ready to search now.',
      status: 'ready',
    }),
  }),
  wantedReleases,
  wantedSummary: Object.freeze({
    lastReconciledAt: '2026-06-20T16:00:00.000Z',
    monitoredArtistCount: 3,
    releaseCounts: Object.freeze({
      missing: 2,
      partial: 1,
      totalWanted: 4,
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
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    let discoverySummary = clone(fixturePayload.discoverySummary);
    globalThis.__harmoniarrDiscoveryRunRequests = [];
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

    function mergeImportReviewWorkspace(workspace) {
      const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
      const state = rawState ? JSON.parse(rawState) : {};
      globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
        ...state,
        importReviewCandidates: Array.isArray(workspace.candidates)
          ? workspace.candidates
          : [],
        importReviewPreviewById: workspace.previewById
          && typeof workspace.previewById === 'object'
          ? workspace.previewById
          : {},
      }));
    }

    function hasImportReviewWorkspace() {
      const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
      const state = rawState ? JSON.parse(rawState) : {};
      return Array.isArray(state.importReviewCandidates) && state.importReviewCandidates.length > 0;
    }

    function countStatuses(items) {
      return items.reduce((counts, item) => ({
        ...counts,
        [item.status]: (counts[item.status] ?? 0) + 1,
      }), {});
    }

    function toScore(value) {
      const parsed = Number.parseFloat(String(value ?? ''));
      return Number.isFinite(parsed) ? parsed : null;
    }

    function buildSelectionReadySummary(release) {
      const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
      const state = rawState ? JSON.parse(rawState) : {};
      const candidates = Array.isArray(state.importReviewCandidates)
        ? state.importReviewCandidates.filter((candidate) =>
          candidate.sourceSearchId === release.discoveryRequest.evidence.lastSearchId)
        : [];

      if (candidates.length < 1) {
        return release.discoveryRequest.importReviewSummary;
      }

      const statusCounts = countStatuses(candidates);
      const scoredCandidates = candidates
        .map((candidate) => toScore(candidate.normalizedPayload?.compositeScore))
        .filter((score) => score !== null)
        .sort((left, right) => right - left);
      const selectedCount = statusCounts.selected ?? 0;
      const downloadingCount = statusCounts.downloading ?? 0;
      const importPendingCount = statusCounts.import_pending ?? 0;
      const reviewableCount = (statusCounts.pending ?? 0) + (statusCounts.held ?? 0);
      const bestCompositeScore = scoredCandidates[0] ?? null;
      const secondBestCompositeScore = scoredCandidates[1] ?? null;
      const scoreGap = bestCompositeScore !== null && secondBestCompositeScore !== null
        ? Number((bestCompositeScore - secondBestCompositeScore).toFixed(2))
        : null;
      const latestCandidate = [...candidates].sort((left, right) =>
        String(right.updatedAt ?? right.discoveredAt ?? '').localeCompare(String(left.updatedAt ?? left.discoveredAt ?? '')),
      )[0];
      let readinessCode = 'auto_selectable';
      let readinessLabel = 'High-confidence candidate';
      let readinessTone = 'info';
      let readinessMessage = 'The best candidate meets selection thresholds. Review and select it to start download handoff.';

      if (downloadingCount + importPendingCount > 0) {
        readinessCode = 'handoff_active';
        readinessLabel = 'Download handoff active';
        readinessMessage = 'A selected candidate is already moving through the download or import pipeline.';
      } else if (selectedCount > 0) {
        readinessCode = 'selected';
        readinessLabel = 'Candidate selected';
        readinessMessage = 'A candidate is selected; the download worker is responsible for enqueueing it next.';
      } else if (reviewableCount < 1) {
        readinessCode = 'not_reviewable';
        readinessLabel = 'No reviewable candidates';
        readinessTone = 'warning';
        readinessMessage = 'Candidates exist, but none are pending or held for selection.';
      }

      return {
        latestStatus: latestCandidate?.status ?? null,
        latestUpdatedAt: latestCandidate?.updatedAt ?? latestCandidate?.discoveredAt ?? null,
        selectionReadiness: {
          bestCompositeScore,
          candidateCount: candidates.length,
          code: readinessCode,
          label: readinessLabel,
          message: readinessMessage,
          reviewableCount,
          scoredCandidateCount: scoredCandidates.length,
          scoreGap,
          secondBestCompositeScore,
          thresholds: {
            ambiguityMargin: 5,
            minCompositeScore: 85,
          },
          tone: readinessTone,
        },
        statusCounts,
        totalCount: candidates.length,
      };
    }

    function buildWantedReleasePayload(release) {
      const clonedRelease = clone(release);
      if (clonedRelease.id !== 'wanted-saw-85-92') {
        return clonedRelease;
      }

      return {
        ...clonedRelease,
        discoveryRequest: {
          ...clonedRelease.discoveryRequest,
          importReviewSummary: buildSelectionReadySummary(clonedRelease),
        },
      };
    }

    if (!hasImportReviewWorkspace()) {
      mergeImportReviewWorkspace(fixturePayload.dispatchImportReviewWorkspace);
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

      if (method === 'GET' && path === '/api/v1/library/discovery-summary') {
        return buildJsonResponse(clone(discoverySummary));
      }

      if (method === 'POST' && path === '/api/v1/library/discovery-runs') {
        const run = {
          candidateCount: 1,
          dispatchedCount: 2,
          finishedAt: '2026-06-27T21:02:30.000Z',
          id: 'library-discovery-run-browser-1',
          startedAt: '2026-06-27T21:02:00.000Z',
          status: 'completed',
          triggerSource: 'manual',
        };
        globalThis.__harmoniarrDiscoveryRunRequests.push({
          csrf: init?.headers?.get?.('X-CSRF-Token') ?? init?.headers?.['X-CSRF-Token'] ?? null,
          method,
          path,
        });
        mergeImportReviewWorkspace(fixturePayload.dispatchImportReviewWorkspace);
        discoverySummary = {
          ...discoverySummary,
          checkedAt: '2026-06-27T21:03:00.000Z',
          latestRun: run,
          requestCounts: {
            blocked: 0,
            cooldown: 3,
            ready: 0,
            totalRequests: 3,
          },
          summary: {
            message: '3 discovery requests are waiting for automatic cooldown expiry.',
            status: 'cooldown',
          },
        };
        return buildJsonResponse({
          accepted: true,
          ok: true,
          run,
        }, 202);
      }

      if (method === 'GET' && path === '/api/v1/library/wanted-releases') {
        const statusFilter = url.searchParams.get('status');
        const filteredWantedReleases = fixturePayload.wantedReleases
          .map(buildWantedReleasePayload)
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
