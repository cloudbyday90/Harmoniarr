/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const mediaRequests = Object.freeze([
  Object.freeze({
    artistName: 'Radiohead',
    artistSortName: 'radiohead',
    createdAt: '2026-06-24T14:30:00.000Z',
    expectedReleaseDate: null,
    fulfillmentStatus: Object.freeze({
      code: 'fulfilled',
      detail: 'Imported media has been applied to the library.',
      label: 'Fulfilled',
      occurredAt: '2026-06-24T15:00:00.000Z',
      tone: 'selected',
    }),
    id: 'req-kid-a',
    matchedMetadataReleaseGroupId: 'mb-rg-kid-a',
    matchedMetadataReleaseId: 'mb-release-kid-a',
    releaseGroupTitle: 'Kid A',
    releaseTitle: 'Kid A',
    requestKind: 'release',
    requestedAt: '2026-06-24T14:30:00.000Z',
    requestedByUser: Object.freeze({ id: 'fixture-admin', username: 'admin' }),
    requestedForUser: Object.freeze({ id: 'fixture-admin', username: 'admin' }),
    requestState: 'already_exists',
    trackTitle: null,
    updatedAt: '2026-06-24T15:00:00.000Z',
  }),
  Object.freeze({
    artistName: 'Autechre',
    artistSortName: 'autechre',
    createdAt: '2026-06-23T12:00:00.000Z',
    expectedReleaseDate: null,
    fulfillmentStatus: Object.freeze({
      code: 'downloading',
      detail: 'Files are currently downloading.',
      label: 'Downloading',
      occurredAt: '2026-06-23T12:10:00.000Z',
      tone: 'held',
    }),
    id: 'req-lp5',
    matchedMetadataReleaseGroupId: 'mb-rg-lp5',
    matchedMetadataReleaseId: 'mb-release-lp5',
    releaseGroupTitle: 'LP5',
    releaseTitle: 'LP5',
    requestKind: 'release',
    requestedAt: '2026-06-23T12:00:00.000Z',
    requestedByUser: Object.freeze({ id: 'fixture-admin', username: 'admin' }),
    requestedForUser: Object.freeze({ id: 'fixture-admin', username: 'admin' }),
    requestState: 'needs_fetch',
    trackTitle: null,
    updatedAt: '2026-06-23T12:10:00.000Z',
  }),
  Object.freeze({
    artistName: 'Boards of Canada',
    artistSortName: 'boards of canada',
    createdAt: '2026-06-22T10:00:00.000Z',
    expectedReleaseDate: null,
    fulfillmentStatus: Object.freeze({
      code: 'queued',
      detail: 'Waiting for fetch and discovery follow-up.',
      label: 'Queued',
      occurredAt: '2026-06-22T10:00:00.000Z',
      tone: 'held',
    }),
    id: 'req-amber',
    matchedMetadataReleaseGroupId: 'mb-rg-music-has-the-right',
    matchedMetadataReleaseId: 'mb-release-music-has-the-right',
    releaseGroupTitle: 'Music Has the Right to Children',
    releaseTitle: 'Music Has the Right to Children',
    requestKind: 'release',
    requestedAt: '2026-06-22T10:00:00.000Z',
    requestedByUser: Object.freeze({ id: 'fixture-admin', username: 'admin' }),
    requestedForUser: Object.freeze({ id: 'fixture-admin', username: 'admin' }),
    requestState: 'needs_fetch',
    trackTitle: null,
    updatedAt: '2026-06-22T10:00:00.000Z',
  }),
  Object.freeze({
    artistName: 'Massive Attack',
    artistSortName: 'massive attack',
    createdAt: '2026-06-21T09:00:00.000Z',
    expectedReleaseDate: null,
    fulfillmentStatus: Object.freeze({
      code: 'failed',
      detail: 'Import execution failed and needs operator attention.',
      label: 'Failed',
      occurredAt: '2026-06-21T09:30:00.000Z',
      tone: 'failed',
    }),
    id: 'req-mezzanine',
    matchedMetadataReleaseGroupId: 'mb-rg-mezzanine',
    matchedMetadataReleaseId: 'mb-release-mezzanine',
    releaseGroupTitle: 'Mezzanine',
    releaseTitle: 'Mezzanine',
    requestKind: 'release',
    requestedAt: '2026-06-21T09:00:00.000Z',
    requestedByUser: Object.freeze({ id: 'fixture-admin', username: 'admin' }),
    requestedForUser: Object.freeze({ id: 'fixture-admin', username: 'admin' }),
    requestState: 'needs_fetch',
    trackTitle: null,
    updatedAt: '2026-06-21T09:30:00.000Z',
  }),
]);

const fixture = Object.freeze({
  mediaRequests,
  requestSummary: Object.freeze({
    counts: Object.freeze({
      alreadyExists: 1,
      needsFetch: 3,
      needsReview: 0,
      totalRequests: 4,
    }),
    fulfillmentCounts: Object.freeze({
      active: 2,
      failed: 1,
      satisfied: 1,
      underReview: 0,
    }),
    notificationFeed: Object.freeze({
      checkedAt: '2026-06-25T16:00:00.000Z',
      counts: Object.freeze({
        byCategory: Object.freeze({
          delegated_request: 0,
          failure: 0,
          fulfillment: 0,
          review: 0,
        }),
        total: 0,
      }),
      notifications: Object.freeze([]),
    }),
    recentRequests: mediaRequests,
    scope: 'mine',
    summary: Object.freeze({
      message: '4 requests are being tracked.',
      status: 'active',
    }),
  }),
});

export async function installMediaRequestBrowserFixtures(browserContext) {
  await browserContext.addInitScript(({ fixturePayload }) => {
    const originalFetch = globalThis.fetch.bind(globalThis);

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

    function findRequest(mediaRequestId) {
      return fixturePayload.mediaRequests.find((request) => request.id === mediaRequestId) ?? null;
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

      if (method === 'GET' && path === '/api/v1/library/media-request-summary') {
        return buildJsonResponse({
          ok: true,
          ...clone(fixturePayload.requestSummary),
        });
      }

      if (method === 'GET' && path === '/api/v1/library/media-requests') {
        return buildJsonResponse({
          mediaRequests: clone(fixturePayload.mediaRequests),
          ok: true,
          scope: url.searchParams.get('scope') ?? 'mine',
          totalCount: fixturePayload.mediaRequests.length,
        });
      }

      const detailMatch = path.match(/^\/api\/v1\/library\/media-requests\/([^/]+)$/u);
      if (method === 'GET' && detailMatch) {
        const mediaRequest = findRequest(decodeURIComponent(detailMatch[1]));
        if (!mediaRequest) {
          return buildJsonResponse({ error: 'not_found', ok: false }, 404);
        }
        return buildJsonResponse({
          events: [],
          hasMoreEvents: false,
          mediaRequest: clone(mediaRequest),
          nextCursor: null,
          ok: true,
        });
      }

      const pipelineMatch = path.match(/^\/api\/v1\/library\/media-requests\/([^/]+)\/pipeline$/u);
      if (method === 'GET' && pipelineMatch) {
        return buildJsonResponse({
          candidates: [],
          ok: true,
        });
      }

      const eventsMatch = path.match(/^\/api\/v1\/library\/media-requests\/([^/]+)\/events$/u);
      if (method === 'GET' && eventsMatch) {
        return buildJsonResponse({
          events: [],
          hasMore: false,
          nextCursor: null,
          ok: true,
        });
      }

      return originalFetch(input, init);
    };
  }, { fixturePayload: fixture });
}
