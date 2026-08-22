/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createApiError, getRequestMetadata, requireCsrf, requireSession } from '../auth.js';
import { createRequestAuthDependencies } from '../auth-module.js';
import { asyncRoute, sanitizePageLimit, sanitizePageOffset } from '../http.js';
import { skipRateLimitMiddleware } from '../request-rate-limiter.js';
import { sendRetiredRouteResponse } from './retired-route-response.js';

const defaultRequestAuthDependencies = createRequestAuthDependencies({
  getRequestMetadata,
  requireCsrf,
  requireSession,
});

function normalizeMetadataError(error) {
  switch (error?.code) {
    case 'validation_error':
      return createApiError(400, error.code, error.message);
    case 'app_user_not_found':
      return createApiError(404, error.code, error.message);
    case 'metadata_not_found':
      return createApiError(404, error.code, error.message);
    case 'musicbrainz_not_found':
      return createApiError(404, error.code, error.message);
    case 'musicbrainz_misconfigured':
      return createApiError(503, error.code, error.message);
    case 'musicbrainz_unavailable':
      return createApiError(503, error.code, 'MusicBrainz is temporarily unavailable');
    case 'musicbrainz_request_failed':
      return createApiError(502, error.code, error.message);
    default:
      return error;
  }
}

function metadataRoute(handler) {
  return asyncRoute(async (request, response, next) => {
    try {
      await handler(request, response, next);
    } catch (error) {
      throw normalizeMetadataError(error);
    }
  });
}

export function registerMetadataRoutes(app, {
  browseMusicBrainzArtistReleaseGroups,
  getRequestMetadata: getRequestMetadataFn = defaultRequestAuthDependencies.getRequestMetadata,
  getMusicBrainzReleaseGroupReleases,
  getMetadataArtist,
  getMetadataArtistDetectionEvents,
  getMetadataArtistByMusicBrainzId,
  getMetadataProviderCacheObservability = () => ({ namespaces: [], observedSinceAt: null, updatedAt: null }),
  getOperatorArtistProjection,
  saveOperatorArtist,
  getMetadataRelease,
  getMetadataReleaseByMusicBrainzId,
  getMetadataReleaseGroup,
  getMetadataReleaseGroupByMusicBrainzId,
  importMusicBrainzArtist,
  importMusicBrainzReleaseGroup,
  importMusicBrainzRelease,
  limitMetadataArtistRefreshRun = skipRateLimitMiddleware,
  limitMetadataImport = skipRateLimitMiddleware,
  limitMetadataMutation = skipRateLimitMiddleware,
  startMetadataArtistRefresh,
  requireCsrf: requireCsrfFn = defaultRequestAuthDependencies.requireCsrf,
  requireFreshAdminSession: requireFreshAdminSessionFn = defaultRequestAuthDependencies.requireFreshAdminSession,
  requireFreshSession: requireFreshSessionFn = defaultRequestAuthDependencies.requireFreshSession,
  requireSession: requireSessionFn = defaultRequestAuthDependencies.requireSession,
  searchLocalMetadataArtists,
  searchLocalMetadataReleaseGroups,
  searchLocalMetadataReleases,
  searchAllLocalMetadata,
  listOperatorMonitoredArtistProjections,
  listAllMonitoredArtists,
  searchMusicBrainzArtists,
  searchMusicBrainzReleases,
  getSimilarArtists,
  getReleaseGroupTracklist,
  markCanonicalRelease,
  queueOperatorArtistReconciliation = async () => {
    throw createApiError(503, 'operator_artist_reconciliation_unavailable', 'Artist reconciliation is temporarily unavailable');
  },
}) {
  function registerSessionGetJsonRoute(path, buildResponseBody) {
    app.get(path, metadataRoute(async (request, response) => {
      await requireSessionFn(request);
      response.json({
        ok: true,
        ...await buildResponseBody(request),
      });
    }));
  }

  function registerImportRoute(path, importEntity, buildImportRequest, buildImportedBody) {
    app.post(path, limitMetadataImport, metadataRoute(async (request, response) => {
      const session = await requireFreshAdminSessionFn(request);
      requireCsrfFn(request, session);

      const imported = await importEntity(buildImportRequest(request, session));

      response.status(201).json({
        ok: true,
        imported: buildImportedBody(imported),
      });
    }));
  }

  // Like registerImportRoute, but requires a fresh authenticated session instead
  // of a fresh admin session, so that requesters can import/upsert entities.
  function registerSessionImportRoute(path, importEntity, buildImportRequest, buildImportedBody) {
    app.post(path, limitMetadataImport, metadataRoute(async (request, response) => {
      const session = await requireFreshSessionFn(request);
      requireCsrfFn(request, session);

      const imported = await importEntity(buildImportRequest(request, session));

      response.status(201).json({
        ok: true,
        imported: buildImportedBody(imported),
      });
    }));
  }

  registerSessionGetJsonRoute('/api/v1/metadata/artists/search', async (request) => ({
    provider: 'local',
    search: await searchLocalMetadataArtists({
      query: request.query.q,
      limit: sanitizePageLimit(request.query.limit, { default: 10, max: 25 }),
    }),
  }));

  registerSessionGetJsonRoute('/api/v1/search', async (request) => ({
    ...await searchAllLocalMetadata({
      query: request.query.q,
      artistLimit: sanitizePageLimit(request.query.artistLimit, { default: 10, max: 25 }),
      releaseGroupLimit: sanitizePageLimit(request.query.releaseGroupLimit, { default: 10, max: 25 }),
      releaseLimit: sanitizePageLimit(request.query.releaseLimit, { default: 10, max: 25 }),
    }),
  }));

  app.get('/api/v1/metadata/artists/monitored', metadataRoute(async (request, response) => {
    await requireSessionFn(request);
    sendRetiredRouteResponse(response, {
      message: 'The shared monitored artist list endpoint has been retired. Use the operator-scoped monitored artist projection endpoint instead.',
      replacementPath: '/api/v1/metadata/artists/monitored/operator',
    });
  }));

  app.get('/api/v1/metadata/artists/monitored/operator', metadataRoute(async (request, response) => {
    const session = await requireSessionFn(request);
    const result = await listOperatorMonitoredArtistProjections({
      appUserId: session.appUserId,
      limit: sanitizePageLimit(request.query.limit, { default: 25, max: 50 }),
    });

    response.json({
      ok: true,
      ...result,
    });
  }));

  app.get('/api/v1/metadata/artists/monitored/admin', metadataRoute(async (request, response) => {
    await requireFreshAdminSessionFn(request);
    const result = await listAllMonitoredArtists({
      search: request.query.search || undefined,
      sort: request.query.sort || undefined,
      limit: sanitizePageLimit(request.query.limit, { default: 25, max: 100 }),
      offset: sanitizePageOffset(request.query.offset),
    });
    response.json({ ok: true, ...result });
  }));

  app.get('/api/v1/metadata/cache-observability', metadataRoute(async (request, response) => {
    await requireFreshAdminSessionFn(request);
    response.json({
      cache: await getMetadataProviderCacheObservability(),
      ok: true,
    });
  }));

  registerSessionGetJsonRoute('/api/v1/metadata/release-groups/search', async (request) => ({
    provider: 'local',
    search: await searchLocalMetadataReleaseGroups({
      query: request.query.q,
      limit: sanitizePageLimit(request.query.limit, { default: 10, max: 25 }),
    }),
  }));

  registerSessionGetJsonRoute('/api/v1/metadata/releases/search', async (request) => ({
    provider: 'local',
    search: await searchLocalMetadataReleases({
      query: request.query.q,
      limit: sanitizePageLimit(request.query.limit, { default: 10, max: 25 }),
    }),
  }));

  registerSessionGetJsonRoute('/api/v1/metadata/artists/:artistId', async (request) => {
    const result = await getMetadataArtist({
      artistId: request.params.artistId,
    });

    return {
      artist: result.artist,
      aliases: result.aliases,
      detectionEvents: result.detectionEvents ?? [],
      detectionEventsPageInfo: result.detectionEventsPageInfo ?? {
        hasMore: false,
        nextCursor: null,
      },
      monitoring: result.monitoring,
      releaseGroups: result.releaseGroups,
      releases: result.releases,
    };
  });

  app.get('/api/v1/metadata/artists/:artistId/operator', metadataRoute(async (request, response) => {
    const session = await requireSessionFn(request);
    const result = await getOperatorArtistProjection({
      appUserId: session.appUserId,
      metadataArtistId: request.params.artistId,
    });

    response.json({
      ok: true,
      aliases: result.aliases,
      artist: result.artist,
      detectionEvents: result.detectionEvents,
      detectionEventsPageInfo: result.detectionEventsPageInfo,
      operator: result.operator,
      releaseGroups: result.releaseGroups,
      releases: result.releases,
    });
  }));

  app.put('/api/v1/metadata/artists/:artistId/operator', limitMetadataMutation, metadataRoute(async (request, response) => {
    const session = await requireFreshSessionFn(request);
    requireCsrfFn(request, session);

    const result = await saveOperatorArtist({
      appUserId: session.appUserId,
      draft: request.body,
      metadataArtistId: request.params.artistId,
      triggeredByUserId: session.appUserId,
    });

    response.json({
      ok: true,
      aliases: result.projection?.aliases ?? [],
      artist: result.projection?.artist ?? null,
      artistId: result.artistId,
      detectionEvents: result.projection?.detectionEvents ?? [],
      detectionEventsPageInfo: result.projection?.detectionEventsPageInfo ?? {
        hasMore: false,
        nextCursor: null,
      },
      operator: result.operator,
      reconciliation: result.reconciliation,
      releaseGroups: result.projection?.releaseGroups ?? [],
      releases: result.projection?.releases ?? [],
      snapshot: result.snapshot,
    });
  }));

  app.post('/api/v1/metadata/artists/:artistId/operator/reconciliation', limitMetadataMutation, metadataRoute(async (request, response) => {
    const session = await requireFreshSessionFn(request);
    requireCsrfFn(request, session);

    const result = await queueOperatorArtistReconciliation({
      appUserId: session.appUserId,
      metadataArtistId: request.params.artistId,
      requestMetadata: getRequestMetadataFn(request),
      triggeredByUserId: session.appUserId,
      triggerSource: 'manual_retry',
    });

    response.status(202).json({
      ok: true,
      reconciliation: result,
    });
  }));

  registerSessionGetJsonRoute('/api/v1/metadata/artists/:artistId/detection-events', async (request) => {
    const result = await getMetadataArtistDetectionEvents({
      artistId: request.params.artistId,
      before: request.query.before,
      limit: sanitizePageLimit(request.query.limit, { default: 10, max: 25 }),
    });

    return {
      detectionEvents: result.entries,
      pageInfo: result.pageInfo,
    };
  });

  // Note: :artistId here is a MusicBrainz artist MBID, not a local database ID.
  // The route is keyed on MBID because both external sources (ListenBrainz and
  // MusicBrainz) require an MBID. The 24-hour per-MBID cache makes this safe to
  // call with any monitored or searched artist regardless of local import state.
  registerSessionGetJsonRoute('/api/v1/metadata/artists/:artistId/similar', async (request) => {
    const result = await getSimilarArtists({
      artistMbid: request.params.artistId,
      limit: sanitizePageLimit(request.query.limit, { default: 20, max: 100 }),
    });

    return {
      cache: result.cache ?? null,
      similar: result.similar,
    };
  });

  registerSessionGetJsonRoute('/api/v1/metadata/musicbrainz/artists/:artistId/local', async (request) => {
    const result = await getMetadataArtistByMusicBrainzId({
      musicBrainzArtistId: request.params.artistId,
    });

    return {
      artist: result.artist,
      aliases: result.aliases,
      detectionEvents: result.detectionEvents ?? [],
      detectionEventsPageInfo: result.detectionEventsPageInfo ?? {
        hasMore: false,
        nextCursor: null,
      },
      monitoring: result.monitoring,
      releaseGroups: result.releaseGroups,
      releases: result.releases,
    };
  });

  app.put('/api/v1/metadata/artists/:artistId/monitoring', limitMetadataMutation, metadataRoute(async (request, response) => {
    await requireSessionFn(request);
    sendRetiredRouteResponse(response, {
      message: 'The legacy artist monitoring endpoint has been retired. Use the operator-scoped artist save endpoint to manage monitoring.',
      replacementPath: '/api/v1/metadata/artists/:artistId/operator',
    });
  }));

  app.post('/api/v1/metadata/artists/:artistId/refresh', limitMetadataArtistRefreshRun, metadataRoute(async (request, response) => {
    const session = await requireFreshAdminSessionFn(request);
    requireCsrfFn(request, session);

    const result = await startMetadataArtistRefresh({
      metadataArtistId: request.params.artistId,
      requestMetadata: getRequestMetadataFn(request),
      triggeredByUserId: session.appUserId,
    });

    response.status(202).json({
      ok: true,
      ...result,
    });
  }));

  registerSessionGetJsonRoute('/api/v1/metadata/release-groups/:releaseGroupId', async (request) => {
    const result = await getMetadataReleaseGroup({
      releaseGroupId: request.params.releaseGroupId,
    });

    return {
      artist: result.artist,
      releaseGroup: result.releaseGroup,
      releases: result.releases,
    };
  });

  registerSessionGetJsonRoute('/api/v1/metadata/musicbrainz/release-groups/:releaseGroupId/local', async (request) => {
    const result = await getMetadataReleaseGroupByMusicBrainzId({
      musicBrainzReleaseGroupId: request.params.releaseGroupId,
    });

    return {
      artist: result.artist,
      releaseGroup: result.releaseGroup,
      releases: result.releases,
    };
  });

  registerSessionGetJsonRoute('/api/v1/metadata/releases/:releaseId', async (request) => {
    const result = await getMetadataRelease({
      releaseId: request.params.releaseId,
    });

    return {
      artist: result.artist,
      releaseGroup: result.releaseGroup,
      release: result.release,
      media: result.media,
    };
  });

  registerSessionGetJsonRoute('/api/v1/metadata/musicbrainz/releases/:releaseId/local', async (request) => {
    const result = await getMetadataReleaseByMusicBrainzId({
      musicBrainzReleaseId: request.params.releaseId,
    });

    return {
      artist: result.artist,
      releaseGroup: result.releaseGroup,
      release: result.release,
      media: result.media,
    };
  });

  registerSessionGetJsonRoute('/api/v1/metadata/musicbrainz/artists/search', async (request) => ({
    provider: 'musicbrainz',
    search: await searchMusicBrainzArtists({
      query: request.query.q,
      limit: sanitizePageLimit(request.query.limit, { default: 10, max: 25 }),
    }),
  }));

  registerSessionGetJsonRoute('/api/v1/metadata/musicbrainz/releases/search', async (request) => ({
    provider: 'musicbrainz',
    search: await searchMusicBrainzReleases({
      artist: request.query.artist,
      release: request.query.release,
      limit: sanitizePageLimit(request.query.limit, { default: 10, max: 25 }),
    }),
  }));

  registerSessionGetJsonRoute('/api/v1/metadata/musicbrainz/artists/:artistId/release-groups', async (request) => ({
    provider: 'musicbrainz',
    browse: await browseMusicBrainzArtistReleaseGroups({
      artistId: request.params.artistId,
      limit: sanitizePageLimit(request.query.limit, { default: 25, max: 25 }),
      offset: sanitizePageOffset(request.query.offset),
      type: request.query.type,
      releaseGroupStatus: request.query.releaseGroupStatus,
    }),
  }));

  registerSessionGetJsonRoute('/api/v1/metadata/musicbrainz/release-groups/:releaseGroupId/releases', async (request) => ({
    provider: 'musicbrainz',
    releases: await getMusicBrainzReleaseGroupReleases({
      releaseGroupId: request.params.releaseGroupId,
      limit: sanitizePageLimit(request.query.limit, { default: 25, max: 25 }),
      offset: sanitizePageOffset(request.query.offset),
    }),
  }));

  registerImportRoute(
    '/api/v1/metadata/musicbrainz/release-groups/:releaseGroupId/import',
    importMusicBrainzReleaseGroup,
    (request, session) => ({
      releaseGroupId: request.params.releaseGroupId,
      actorUserId: session.appUserId,
      requestMetadata: getRequestMetadataFn(request),
    }),
    (imported) => ({
      artistId: imported.artist.id,
      releaseGroupId: imported.releaseGroup.id,
      source: imported.source,
    }),
  );

  registerSessionImportRoute(
    '/api/v1/metadata/musicbrainz/artists/:artistId/import',
    importMusicBrainzArtist,
    (request, session) => ({
      artistId: request.params.artistId,
      actorUserId: session.appUserId,
      requestMetadata: getRequestMetadataFn(request),
    }),
    (imported) => ({
      artistId: imported.artist.id,
      source: imported.source,
    }),
  );

  registerImportRoute(
    '/api/v1/metadata/musicbrainz/releases/:releaseId/import',
    importMusicBrainzRelease,
    (request, session) => ({
      releaseId: request.params.releaseId,
      actorUserId: session.appUserId,
      requestMetadata: getRequestMetadataFn(request),
    }),
    (imported) => ({
      artistId: imported.artist.id,
      releaseGroupId: imported.releaseGroup.id,
      releaseId: imported.release.id,
      source: imported.source,
    }),
  );

  app.get('/api/v1/metadata/musicbrainz/release-groups/:releaseGroupId/tracklist', metadataRoute(async (request, response) => {
    const session = await requireSessionFn(request);
    const result = await getReleaseGroupTracklist({
      releaseGroupMbid: request.params.releaseGroupId,
      preferReleaseMbid: request.query.preferReleaseMbid ?? null,
      preferReleaseId: request.query.preferReleaseId ?? null,
      sessionUserId: session.appUserId,
    });

    response.json({
      ok: true,
      release: result.release,
      media: result.media,
      ownership: result.ownership,
      allReleases: result.allReleases,
      requestState: result.requestState,
      source: result.source,
    });
  }));

  app.patch('/api/v1/metadata/releases/:releaseId/canonical', limitMetadataMutation, metadataRoute(async (request, response) => {
    const session = await requireFreshAdminSessionFn(request);
    requireCsrfFn(request, session);

    const releaseId = request.params.releaseId;
    const result = await markCanonicalRelease(releaseId);

    if (!result) {
      throw createApiError(404, 'metadata_not_found', `Release not found: ${releaseId}`);
    }

    response.json({ ok: true, releaseId, releaseGroupId: result.releaseGroupId });
  }));
}
