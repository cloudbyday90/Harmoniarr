import assert from 'node:assert/strict';
import test from 'node:test';
import { registerMetadataRoutes } from '../../src/server/routes/metadata-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createMetadataRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerMetadataRoutes(app, {
      browseMusicBrainzArtistReleaseGroups: async () => ({ browse: { results: [] } }),
      getRequestMetadata: (request) => ({
        ipAddress: request.headers['x-forwarded-for'] ?? '127.0.0.1',
        userAgent: request.headers['user-agent'] ?? null,
      }),
      getMusicBrainzReleaseGroupReleases: async () => ({ results: [] }),
      getMetadataArtist: async ({ artistId }) => ({
        artist: { id: artistId, name: 'Autechre' },
        aliases: [],
        monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album', 'ep'] },
        releaseGroups: [],
        releases: [],
      }),
      getMetadataArtistDetectionEvents: async () => ({
        entries: [],
        pageInfo: {
          hasMore: false,
          nextCursor: null,
        },
      }),
      getMetadataArtistByMusicBrainzId: async ({ musicBrainzArtistId }) => ({
        artist: { id: 'local-artist-1', source: { musicbrainzArtistId: musicBrainzArtistId } },
        aliases: [],
        monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album', 'ep'] },
        releaseGroups: [],
        releases: [],
      }),
      getOperatorArtistProjection: async ({ appUserId, metadataArtistId }) => ({
        aliases: [],
        artist: { id: metadataArtistId, name: 'Autechre' },
        detectionEvents: [],
        detectionEventsPageInfo: { hasMore: false, nextCursor: null },
        operator: {
          monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album', 'ep'] },
          overview: {
            desiredReleaseGroupCount: 0,
            releaseGroupCount: 0,
            trackOverrideCount: 0,
          },
          reconciliation: {
            latestRun: null,
            latestSnapshot: null,
            pendingRun: null,
            runningRun: null,
            status: 'idle',
          },
          releaseGroupSelections: [],
          sessionUserId: appUserId,
          trackOverrides: [],
        },
        releaseGroups: [],
        releases: [],
      }),
      listOperatorMonitoredArtistProjections: async ({ appUserId, limit }) => ({
        limit,
        results: [{
          artist: { id: 'artist-1', name: 'Autechre', sortName: 'Autechre' },
          operator: {
            monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album', 'ep'] },
            overview: {
              desiredReleaseGroupCount: 0,
              releaseGroupCount: 0,
              trackOverrideCount: 0,
            },
            reconciliation: {
              latestRun: null,
              latestSnapshot: null,
              pendingRun: null,
              runningRun: null,
              status: 'idle',
            },
          },
          sessionUserId: appUserId,
        }],
      }),
      queueOperatorArtistReconciliation: async ({ appUserId, metadataArtistId, requestMetadata, triggeredByUserId, triggerSource }) => ({
        accepted: true,
        coalesced: false,
        queuedBehindRun: false,
        replacedPending: false,
        run: {
          appUserId,
          id: `run-${metadataArtistId}`,
          metadataArtistId,
          requestMetadata,
          status: 'pending',
          triggeredByUserId,
          triggerSource,
        },
        runningRun: null,
      }),
      saveOperatorArtist: async ({ appUserId, draft, metadataArtistId }) => ({
        artistId: metadataArtistId,
        operator: {
          monitoring: {
            isMonitored: draft?.monitoring?.isMonitored === true,
          },
        },
        projection: {
          releaseGroups: [],
          releases: [],
        },
        reconciliation: {
          accepted: true,
          coalesced: false,
          queuedBehindRun: false,
          replacedPending: false,
          run: { id: 'run-1', status: 'pending' },
          runningRun: null,
        },
        snapshot: {
          id: `snapshot-${appUserId}`,
          snapshotRevision: 1,
        },
      }),
      getMetadataRelease: async () => ({ artist: null, releaseGroup: null, release: null, media: [] }),
      getMetadataReleaseByMusicBrainzId: async () => ({ artist: null, releaseGroup: null, release: null, media: [] }),
      getMetadataReleaseGroup: async () => ({ artist: null, releaseGroup: null, releases: [] }),
      getMetadataReleaseGroupByMusicBrainzId: async () => ({ artist: null, releaseGroup: null, releases: [] }),
      importMusicBrainzArtist: async ({ artistId, actorUserId, requestMetadata }) => ({
        artist: { id: `local-${artistId}` },
        source: { actorUserId, requestMetadata },
      }),
      startMetadataArtistRefresh: async ({ metadataArtistId, triggeredByUserId, requestMetadata }) => ({
        accepted: true,
        run: {
          id: `run-${metadataArtistId}`,
          metadataArtistId,
          triggeredByUserId,
          requestMetadata,
        },
      }),
      importMusicBrainzReleaseGroup: async ({ releaseGroupId, actorUserId, requestMetadata }) => ({
        artist: { id: 'artist-1' },
        releaseGroup: { id: `local-${releaseGroupId}` },
        source: { actorUserId, requestMetadata },
      }),
      importMusicBrainzRelease: async ({ releaseId, actorUserId, requestMetadata }) => ({
        artist: { id: 'artist-1' },
        releaseGroup: { id: 'release-group-1' },
        release: { id: `local-${releaseId}` },
        source: { actorUserId, requestMetadata },
      }),
      updateMetadataArtistMonitoring: async () => {},
      requireCsrf: () => {},
      requireFreshAdminSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', csrfTokenHash: 'hashed', user: { role: 'admin' } }),
      requireFreshSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', csrfTokenHash: 'hashed' }),
      requireSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', csrfTokenHash: 'hashed' }),
      searchLocalMetadataArtists: async ({ query, limit }) => ({ query, limit: Number(limit), results: [{ id: 'artist-1', name: query }] }),
      searchLocalMetadataReleaseGroups: async ({ query, limit }) => ({ query, limit: Number(limit), results: [{ id: 'rg-1', title: query }] }),
      searchLocalMetadataReleases: async ({ query, limit }) => ({ query, limit: Number(limit), results: [{ id: 'release-1', title: query }] }),
      searchMusicBrainzArtists: async () => ({ results: [] }),
      searchMusicBrainzReleases: async () => ({ results: [] }),
      getSimilarArtists: async () => ({ similar: [] }),
      getReleaseGroupTracklist: async () => ({
        release: null,
        media: [],
        ownership: {},
        allReleases: [],
        requestState: {},
        source: 'local',
      }),
      markCanonicalRelease: async () => null,
      ...overrides,
    });
  });
}

test('metadata shared monitored artists route returns a retired endpoint response', async (t) => {
  const getMetadataArtist = t.mock.fn(async ({ artistId }) => ({
    artist: { id: artistId, name: 'Dynamic artist route should not handle this path' },
    aliases: [],
    monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album', 'ep'] },
    releaseGroups: [],
    releases: [],
  }));
  const listMonitoredArtists = t.mock.fn(async () => {
    throw new Error('retired route must not read shared monitored artist payloads');
  });
  const app = createMetadataRouteTestApp({ getMetadataArtist, listMonitoredArtists });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/artists/monitored?limit=10`);
    const payload = await response.json();

    assert.equal(response.status, 410);
    assert.equal(getMetadataArtist.mock.callCount(), 0);
    assert.equal(listMonitoredArtists.mock.callCount(), 0);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'endpoint_retired',
        message: 'The shared monitored artist list endpoint has been retired. Use the operator-scoped monitored artist projection endpoint instead.',
        replacementPath: '/api/v1/metadata/artists/monitored/operator',
      },
    });
  });
});

test('metadata operator monitored artists route returns the operator-scoped projection payload', async (t) => {
  const listOperatorMonitoredArtistProjections = t.mock.fn(async ({ appUserId, limit }) => ({
    limit,
    results: [{
      artist: {
        id: 'artist-1',
        name: 'Autechre',
        sortName: 'Autechre',
      },
      operator: {
        monitoring: {
          isMonitored: true,
          monitoredReleaseGroupTypes: ['album', 'ep'],
        },
        overview: {
          desiredReleaseGroupCount: 2,
          releaseGroupCount: 4,
          trackOverrideCount: 1,
        },
        reconciliation: {
          latestRun: null,
          latestSnapshot: null,
          pendingRun: null,
          runningRun: null,
          status: 'idle',
        },
      },
    }],
  }));
  const app = createMetadataRouteTestApp({ listOperatorMonitoredArtistProjections });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/artists/monitored/operator?limit=10`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(listOperatorMonitoredArtistProjections.mock.calls[0].arguments[0], {
      appUserId: 'user-1',
      limit: 10,
    });
    assert.deepEqual(payload, {
      ok: true,
      limit: 10,
      results: [{
        artist: {
          id: 'artist-1',
          name: 'Autechre',
          sortName: 'Autechre',
        },
        operator: {
          monitoring: {
            isMonitored: true,
            monitoredReleaseGroupTypes: ['album', 'ep'],
          },
          overview: {
            desiredReleaseGroupCount: 2,
            releaseGroupCount: 4,
            trackOverrideCount: 1,
          },
          reconciliation: {
            latestRun: null,
            latestSnapshot: null,
            pendingRun: null,
            runningRun: null,
            status: 'idle',
          },
        },
      }],
    });
  });
});

test('metadata cache observability route requires a fresh admin session and returns aggregate metrics', async (t) => {
  const getMetadataProviderCacheObservability = t.mock.fn(async () => ({
    namespaces: [{
      cacheNamespace: 'musicbrainz.artist_release_groups',
      cacheStoreErrors: { read: 0, write: 0 },
      lookups: { cold: 1, fresh: 2, stale: 3 },
      refreshes: {},
    }],
    observedSinceAt: '2026-08-22T11:00:00.000Z',
    updatedAt: '2026-08-22T12:00:00.000Z',
  }));
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1' }));
  const app = createMetadataRouteTestApp({
    getMetadataProviderCacheObservability,
    requireFreshAdminSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/cache-observability`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(getMetadataProviderCacheObservability.mock.callCount(), 1);
    assert.deepEqual(payload, {
      cache: {
        namespaces: [{
          cacheNamespace: 'musicbrainz.artist_release_groups',
          cacheStoreErrors: { read: 0, write: 0 },
          lookups: { cold: 1, fresh: 2, stale: 3 },
          refreshes: {},
        }],
        observedSinceAt: '2026-08-22T11:00:00.000Z',
        updatedAt: '2026-08-22T12:00:00.000Z',
      },
      ok: true,
    });
  });
});

test('metadata local artist search route returns the shared search payload', async () => {
  const app = createMetadataRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/artists/search?q=Autechre&limit=6`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, {
      ok: true,
      provider: 'local',
      search: {
        query: 'Autechre',
        limit: 6,
        results: [{ id: 'artist-1', name: 'Autechre' }],
      },
    });
  });
});

test('metadata provider artist browse route preserves the SWR cache metadata inside its browse envelope', async (t) => {
  const browseMusicBrainzArtistReleaseGroups = t.mock.fn(async ({ artistId, limit, offset }) => ({
    cache: { lookup: 'stale', refresh: 'background', refreshDurationMs: null, state: 'stale' },
    limit,
    offset,
    results: [{ id: 'release-group-1', title: 'Amber' }],
    total: 1,
  }));
  const app = createMetadataRouteTestApp({ browseMusicBrainzArtistReleaseGroups });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/musicbrainz/artists/artist-1/release-groups?limit=10&offset=5`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(browseMusicBrainzArtistReleaseGroups.mock.calls[0].arguments[0], {
      artistId: 'artist-1',
      limit: 10,
      offset: 5,
      releaseGroupStatus: undefined,
      type: undefined,
    });
    assert.deepEqual(payload, {
      browse: {
        cache: { lookup: 'stale', refresh: 'background', refreshDurationMs: null, state: 'stale' },
        limit: 10,
        offset: 5,
        results: [{ id: 'release-group-1', title: 'Amber' }],
        total: 1,
      },
      ok: true,
      provider: 'musicbrainz',
    });
  });
});

test('metadata local artist read route returns the local canonical payload', async () => {
  const app = createMetadataRouteTestApp({
    getMetadataArtist: async ({ artistId }) => ({
      artist: { id: artistId, name: 'Boards of Canada' },
      aliases: [{ id: 'alias-1', name: 'BoC' }],
      detectionEvents: [{
        id: 'event-1',
        monitoringDecision: 'wanted_release_detected',
        occurredAt: '2026-05-02T12:00:00.000Z',
        primaryType: 'Album',
        resultingWantedStatus: 'missing',
        title: 'Tomorrow\'s Harvest',
      }],
      monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album'] },
      releaseGroups: [{ id: 'rg-1', title: 'Music Has the Right to Children' }],
      releases: [{ id: 'release-1', title: 'Geogaddi' }],
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/artists/local-artist-1`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, {
      ok: true,
      artist: { id: 'local-artist-1', name: 'Boards of Canada' },
      aliases: [{ id: 'alias-1', name: 'BoC' }],
      detectionEvents: [{
        id: 'event-1',
        monitoringDecision: 'wanted_release_detected',
        occurredAt: '2026-05-02T12:00:00.000Z',
        primaryType: 'Album',
        resultingWantedStatus: 'missing',
        title: 'Tomorrow\'s Harvest',
      }],
      detectionEventsPageInfo: {
        hasMore: false,
        nextCursor: null,
      },
      monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album'] },
      releaseGroups: [{ id: 'rg-1', title: 'Music Has the Right to Children' }],
      releases: [{ id: 'release-1', title: 'Geogaddi' }],
    });
  });
});

test('metadata operator artist read route returns the operator-scoped projection payload', async (t) => {
  const getOperatorArtistProjection = t.mock.fn(async ({ appUserId, metadataArtistId }) => ({
    aliases: [{ id: 'alias-1', alias: 'BoC' }],
    artist: { id: metadataArtistId, name: 'Boards of Canada' },
    detectionEvents: [],
    detectionEventsPageInfo: {
      hasMore: false,
      nextCursor: null,
    },
    operator: {
      monitoring: {
        acquisitionProfileKey: 'balanced_library',
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album', 'ep'],
      },
      overview: {
        desiredReleaseGroupCount: 2,
        hasManualOverrides: true,
        releaseGroupCount: 3,
        trackOverrideCount: 1,
      },
      reconciliation: {
        latestRun: { id: 'run-1', status: 'completed' },
        latestSnapshot: { id: 'snapshot-2', snapshotRevision: 2 },
        pendingRun: null,
        runningRun: null,
        status: 'completed',
      },
      releaseGroupSelections: [{
        metadataReleaseGroupId: 'rg-1',
        selectionSource: 'manual',
        selectionState: 'selected',
      }],
      trackOverrides: [{
        metadataReleaseGroupId: 'rg-1',
        trackMbid: 'track-1',
      }],
    },
    releaseGroups: [{
      id: 'rg-1',
      operatorState: {
        selectionSource: 'manual',
        selectionState: 'selected',
      },
      title: 'Music Has the Right to Children',
    }],
    releases: [{ id: 'release-1', title: 'Music Has the Right to Children' }],
  }));
  const app = createMetadataRouteTestApp({ getOperatorArtistProjection });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/artists/local-artist-1/operator`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(getOperatorArtistProjection.mock.calls[0].arguments, [{
      appUserId: 'user-1',
      metadataArtistId: 'local-artist-1',
    }]);
    assert.deepEqual(payload, {
      ok: true,
      aliases: [{ id: 'alias-1', alias: 'BoC' }],
      artist: { id: 'local-artist-1', name: 'Boards of Canada' },
      detectionEvents: [],
      detectionEventsPageInfo: {
        hasMore: false,
        nextCursor: null,
      },
      operator: {
        monitoring: {
          acquisitionProfileKey: 'balanced_library',
          isMonitored: true,
          monitoredReleaseGroupTypes: ['album', 'ep'],
        },
        overview: {
          desiredReleaseGroupCount: 2,
          hasManualOverrides: true,
          releaseGroupCount: 3,
          trackOverrideCount: 1,
        },
        reconciliation: {
          latestRun: { id: 'run-1', status: 'completed' },
          latestSnapshot: { id: 'snapshot-2', snapshotRevision: 2 },
          pendingRun: null,
          runningRun: null,
          status: 'completed',
        },
        releaseGroupSelections: [{
          metadataReleaseGroupId: 'rg-1',
          selectionSource: 'manual',
          selectionState: 'selected',
        }],
        trackOverrides: [{
          metadataReleaseGroupId: 'rg-1',
          trackMbid: 'track-1',
        }],
      },
      releaseGroups: [{
        id: 'rg-1',
        operatorState: {
          selectionSource: 'manual',
          selectionState: 'selected',
        },
        title: 'Music Has the Right to Children',
      }],
      releases: [{ id: 'release-1', title: 'Music Has the Right to Children' }],
    });
  });
});

test('metadata operator artist save route persists the operator draft payload', async (t) => {
  const saveOperatorArtist = t.mock.fn(async ({ appUserId, draft, metadataArtistId, triggeredByUserId }) => ({
    artistId: metadataArtistId,
    operator: {
      monitoring: {
        isMonitored: true,
        selectionSourceMode: 'policy_plus_overrides',
      },
    },
    projection: {
      aliases: [{ id: 'alias-1', alias: 'BoC' }],
      artist: { id: metadataArtistId, name: 'Boards of Canada' },
      detectionEvents: [],
      detectionEventsPageInfo: {
        hasMore: false,
        nextCursor: null,
      },
      releaseGroups: [{ id: 'rg-1' }],
      releases: [{ id: 'release-1' }],
    },
    reconciliation: {
      accepted: true,
      coalesced: false,
      queuedBehindRun: false,
      replacedPending: false,
      run: { id: 'run-1', status: 'pending' },
      runningRun: null,
    },
    snapshot: {
      id: 'snapshot-1',
      snapshotRevision: 1,
    },
    triggeredByUserId,
    userId: appUserId,
    wasDraftMonitored: draft.monitoring.isMonitored,
  }));
  const app = createMetadataRouteTestApp({ saveOperatorArtist });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/artists/local-artist-1/operator`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({
        monitoring: {
          isMonitored: true,
          selectionSourceMode: 'policy_plus_overrides',
        },
        releaseGroupSelections: [{
          metadataReleaseGroupId: 'rg-1',
          selectionState: 'selected',
        }],
        trackOverrides: [],
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(saveOperatorArtist.mock.calls[0].arguments[0], {
      appUserId: 'user-1',
      draft: {
        monitoring: {
          isMonitored: true,
          selectionSourceMode: 'policy_plus_overrides',
        },
        releaseGroupSelections: [{
          metadataReleaseGroupId: 'rg-1',
          selectionState: 'selected',
        }],
        trackOverrides: [],
      },
      metadataArtistId: 'local-artist-1',
      triggeredByUserId: 'user-1',
    });
    assert.deepEqual(payload, {
      ok: true,
      aliases: [{ id: 'alias-1', alias: 'BoC' }],
      artist: { id: 'local-artist-1', name: 'Boards of Canada' },
      artistId: 'local-artist-1',
      detectionEvents: [],
      detectionEventsPageInfo: {
        hasMore: false,
        nextCursor: null,
      },
      operator: {
        monitoring: {
          isMonitored: true,
          selectionSourceMode: 'policy_plus_overrides',
        },
      },
      reconciliation: {
        accepted: true,
        coalesced: false,
        queuedBehindRun: false,
        replacedPending: false,
        run: { id: 'run-1', status: 'pending' },
        runningRun: null,
      },
      releaseGroups: [{ id: 'rg-1' }],
      releases: [{ id: 'release-1' }],
      snapshot: {
        id: 'snapshot-1',
        snapshotRevision: 1,
      },
    });
  });
});

test('metadata operator artist reconciliation route queues an operator-scoped retry', async (t) => {
  const queueOperatorArtistReconciliation = t.mock.fn(async (input) => ({
    accepted: true,
    coalesced: false,
    queuedBehindRun: false,
    replacedPending: false,
    run: { id: 'run-local-artist-1', status: 'pending' },
    runningRun: null,
    input,
  }));
  const requireCsrf = t.mock.fn();
  const requireFreshSession = t.mock.fn(async () => ({ appUserId: 'user-7', csrfToken: 'csrf-token', csrfTokenHash: 'hashed' }));
  const app = createMetadataRouteTestApp({
    queueOperatorArtistReconciliation,
    requireCsrf,
    requireFreshSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/artists/local-artist-1/operator/reconciliation`, {
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-token',
        'x-forwarded-for': '203.0.113.88',
        'user-agent': 'HarmoniarrRouteTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(queueOperatorArtistReconciliation.mock.calls[0].arguments[0], {
      appUserId: 'user-7',
      metadataArtistId: 'local-artist-1',
      requestMetadata: {
        ipAddress: '203.0.113.88',
        userAgent: 'HarmoniarrRouteTest/1.0',
      },
      triggeredByUserId: 'user-7',
      triggerSource: 'manual_retry',
    });
    assert.deepEqual(payload, {
      ok: true,
      reconciliation: {
        accepted: true,
        coalesced: false,
        queuedBehindRun: false,
        replacedPending: false,
        run: { id: 'run-local-artist-1', status: 'pending' },
        runningRun: null,
        input: {
          appUserId: 'user-7',
          metadataArtistId: 'local-artist-1',
          requestMetadata: {
            ipAddress: '203.0.113.88',
            userAgent: 'HarmoniarrRouteTest/1.0',
          },
          triggeredByUserId: 'user-7',
          triggerSource: 'manual_retry',
        },
      },
    });
  });
});

test('metadata artist detection-events route returns the shared paginated history payload', async (t) => {
  const getMetadataArtistDetectionEvents = t.mock.fn(async ({ artistId, before, limit }) => ({
    entries: [{
      id: 'event-1',
      metadataArtistId: artistId,
      metadataReleaseGroupId: 'rg-1',
      monitoringDecision: 'wanted_release_detected',
      occurredAt: '2026-05-02T12:00:00.000Z',
      primaryType: 'Album',
      resultingWantedStatus: 'missing',
      title: 'Tomorrow\'s Harvest',
    }],
    pageInfo: {
      hasMore: true,
      nextCursor: 'cursor-2',
    },
  }));
  const app = createMetadataRouteTestApp({ getMetadataArtistDetectionEvents });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/artists/local-artist-1/detection-events?before=cursor-1&limit=15`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(getMetadataArtistDetectionEvents.mock.calls[0].arguments, [{
      artistId: 'local-artist-1',
      before: 'cursor-1',
      limit: 15,
    }]);
    assert.deepEqual(payload, {
      ok: true,
      detectionEvents: [{
        id: 'event-1',
        metadataArtistId: 'local-artist-1',
        metadataReleaseGroupId: 'rg-1',
        monitoringDecision: 'wanted_release_detected',
        occurredAt: '2026-05-02T12:00:00.000Z',
        primaryType: 'Album',
        resultingWantedStatus: 'missing',
        title: 'Tomorrow\'s Harvest',
      }],
      pageInfo: {
        hasMore: true,
        nextCursor: 'cursor-2',
      },
    });
  });
});

test('metadata artist monitoring route is retired and points to the operator save endpoint', async (t) => {
  const app = createMetadataRouteTestApp({});

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/artists/local-artist-1/monitoring`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album'],
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 410);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'endpoint_retired');
    assert.equal(
      payload.error.replacementPath,
      '/api/v1/metadata/artists/:artistId/operator',
    );
  });
});

test('metadata artist refresh route queues a shared metadata refresh run', async (t) => {
  const startMetadataArtistRefresh = t.mock.fn(async ({ metadataArtistId, triggeredByUserId, requestMetadata }) => ({
    accepted: true,
    run: {
      id: 'run-local-artist-1',
      metadataArtistId,
      triggeredByUserId,
      requestMetadata,
    },
  }));
  const requireCsrf = t.mock.fn();
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'user-4', csrfToken: 'csrf-token', csrfTokenHash: 'hashed', user: { role: 'admin' } }));
  const app = createMetadataRouteTestApp({
    requireCsrf,
    requireFreshAdminSession,
    startMetadataArtistRefresh,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/artists/local-artist-1/refresh`, {
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-token',
        'x-forwarded-for': '198.51.100.24',
        'user-agent': 'HarmoniarrTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(startMetadataArtistRefresh.mock.callCount(), 1);
    assert.deepEqual(startMetadataArtistRefresh.mock.calls[0].arguments[0], {
      metadataArtistId: 'local-artist-1',
      requestMetadata: {
        ipAddress: '198.51.100.24',
        userAgent: 'HarmoniarrTest/1.0',
      },
      triggeredByUserId: 'user-4',
    });
    assert.deepEqual(payload, {
      ok: true,
      accepted: true,
      run: {
        id: 'run-local-artist-1',
        metadataArtistId: 'local-artist-1',
        triggeredByUserId: 'user-4',
        requestMetadata: {
          ipAddress: '198.51.100.24',
          userAgent: 'HarmoniarrTest/1.0',
        },
      },
    });
  });
});

test('metadata local release-group read route returns the local canonical payload', async () => {
  const app = createMetadataRouteTestApp({
    getMetadataReleaseGroup: async ({ releaseGroupId }) => ({
      artist: { id: 'artist-1', name: 'Biosphere' },
      releaseGroup: { id: releaseGroupId, title: 'Substrata' },
      releases: [{ id: 'release-1', title: 'Substrata (CD)' }],
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/release-groups/local-rg-1`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, {
      ok: true,
      artist: { id: 'artist-1', name: 'Biosphere' },
      releaseGroup: { id: 'local-rg-1', title: 'Substrata' },
      releases: [{ id: 'release-1', title: 'Substrata (CD)' }],
    });
  });
});

test('metadata provider release-group releases route returns the shared browse payload', async (t) => {
  const getMusicBrainzReleaseGroupReleases = t.mock.fn(async ({ releaseGroupId, limit, offset }) => ({
    results: [{ id: 'mb-release-1', title: 'Substrata' }],
    releaseGroupId,
    limit: Number(limit),
    offset: Number(offset),
  }));
  const app = createMetadataRouteTestApp({ getMusicBrainzReleaseGroupReleases });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/musicbrainz/release-groups/mb-rg-1/releases?limit=5&offset=10`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(getMusicBrainzReleaseGroupReleases.mock.callCount(), 1);
    assert.deepEqual(getMusicBrainzReleaseGroupReleases.mock.calls[0].arguments, [{
      releaseGroupId: 'mb-rg-1',
      limit: 5,
      offset: 10,
    }]);
    assert.deepEqual(payload, {
      ok: true,
      provider: 'musicbrainz',
      releases: {
        results: [{ id: 'mb-release-1', title: 'Substrata' }],
        releaseGroupId: 'mb-rg-1',
        limit: 5,
        offset: 10,
      },
    });
  });
});

test('metadata import route passes session and request metadata to the shared import service', async (t) => {
  const importMusicBrainzArtist = t.mock.fn(async ({ artistId, actorUserId, requestMetadata }) => ({
    artist: { id: `local-${artistId}` },
    source: { actorUserId, requestMetadata },
  }));
  const requireCsrf = t.mock.fn();
  const requireFreshSession = t.mock.fn(async () => ({ appUserId: 'user-9', csrfToken: 'csrf-token', csrfTokenHash: 'hashed' }));

  const app = createMetadataRouteTestApp({
    importMusicBrainzArtist,
    requireCsrf,
    requireFreshSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/musicbrainz/artists/mb-artist-1/import`, {
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-token',
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'HarmoniarrTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
  assert.equal(requireFreshSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(importMusicBrainzArtist.mock.callCount(), 1);
    assert.deepEqual(importMusicBrainzArtist.mock.calls[0].arguments, [{
      artistId: 'mb-artist-1',
      actorUserId: 'user-9',
      requestMetadata: {
        ipAddress: '203.0.113.10',
        userAgent: 'HarmoniarrTest/1.0',
      },
    }]);
    assert.deepEqual(payload, {
      ok: true,
      imported: {
        artistId: 'local-mb-artist-1',
        source: {
          actorUserId: 'user-9',
          requestMetadata: {
            ipAddress: '203.0.113.10',
            userAgent: 'HarmoniarrTest/1.0',
          },
        },
      },
    });
  });
});

test('metadata release import route returns the shared imported release payload', async (t) => {
  const importMusicBrainzRelease = t.mock.fn(async ({ releaseId, actorUserId, requestMetadata }) => ({
    artist: { id: 'artist-2' },
    releaseGroup: { id: 'release-group-2' },
    release: { id: `local-${releaseId}` },
    source: { actorUserId, requestMetadata },
  }));
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'user-11', csrfToken: 'csrf-token', csrfTokenHash: 'hashed', user: { role: 'admin' } }));

  const app = createMetadataRouteTestApp({
    importMusicBrainzRelease,
    requireFreshAdminSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/musicbrainz/releases/mb-release-9/import`, {
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-token',
        'x-forwarded-for': '198.51.100.8',
        'user-agent': 'HarmoniarrRouteTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
  assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(importMusicBrainzRelease.mock.callCount(), 1);
    assert.deepEqual(importMusicBrainzRelease.mock.calls[0].arguments, [{
      releaseId: 'mb-release-9',
      actorUserId: 'user-11',
      requestMetadata: {
        ipAddress: '198.51.100.8',
        userAgent: 'HarmoniarrRouteTest/1.0',
      },
    }]);
    assert.deepEqual(payload, {
      ok: true,
      imported: {
        artistId: 'artist-2',
        releaseGroupId: 'release-group-2',
        releaseId: 'local-mb-release-9',
        source: {
          actorUserId: 'user-11',
          requestMetadata: {
            ipAddress: '198.51.100.8',
            userAgent: 'HarmoniarrRouteTest/1.0',
          },
        },
      },
    });
  });
});

test('metadata routes normalize shared metadata not found errors to 404 responses', async () => {
  const app = createMetadataRouteTestApp({
    getMetadataArtist: async () => {
      const error = new Error('Artist not found');
      error.code = 'metadata_not_found';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/artists/missing-artist`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'metadata_not_found',
        message: 'Artist not found',
      },
    });
  });
});

test('metadata routes normalize shared musicbrainz unavailable errors to 503 responses', async () => {
  const app = createMetadataRouteTestApp({
    searchMusicBrainzArtists: async () => {
      const error = new Error('MusicBrainz temporarily overloaded');
      error.code = 'musicbrainz_unavailable';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/musicbrainz/artists/search?q=Autechre`);
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'musicbrainz_unavailable',
        message: 'MusicBrainz is temporarily unavailable',
      },
    });
  });
});

test('metadata routes normalize shared musicbrainz misconfigured errors to 503 responses', async () => {
  const app = createMetadataRouteTestApp({
    browseMusicBrainzArtistReleaseGroups: async () => {
      const error = new Error('MusicBrainz requests require HARMONIARR_CONTACT_URL or HARMONIARR_CONTACT_EMAIL');
      error.code = 'musicbrainz_misconfigured';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/musicbrainz/artists/mb-artist-1/release-groups`);
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'musicbrainz_misconfigured',
        message: 'MusicBrainz requests require HARMONIARR_CONTACT_URL or HARMONIARR_CONTACT_EMAIL',
      },
    });
  });
});

test('metadata routes normalize shared musicbrainz request failures to 502 responses', async () => {
  const app = createMetadataRouteTestApp({
    getMusicBrainzReleaseGroupReleases: async () => {
      const error = new Error('MusicBrainz release-group release browse request failed with status 502');
      error.code = 'musicbrainz_request_failed';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/musicbrainz/release-groups/mb-rg-1/releases`);
    const payload = await response.json();

    assert.equal(response.status, 502);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'musicbrainz_request_failed',
        message: 'MusicBrainz release-group release browse request failed with status 502',
      },
    });
  });
});
test('metadata import route preserves auth-guard failures from the injected session guard', async () => {
  const app = createMetadataRouteTestApp({
    requireFreshSession: async () => {
      throw Object.assign(new Error('Re-authentication is required before continuing'), {
        status: 403,
        code: 'reauth_required',
      });
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/musicbrainz/artists/mb-artist-1/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'reauth_required',
        message: 'Re-authentication is required before continuing',
      },
    });
  });
});

test('metadata artist monitoring route does not invoke the admin session guard', async (t) => {
  // Regression guard: the retired route must not regress to requireFreshAdminSession.
  // It returns 410 (retired) after a normal session check.
  const requireFreshAdminSession = t.mock.fn(async () => {
    throw Object.assign(new Error('Administrator access is required'), {
      status: 403,
      code: 'admin_required',
    });
  });
  const app = createMetadataRouteTestApp({ requireFreshAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/artists/local-artist-1/monitoring`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({ isMonitored: true }),
    });

    assert.equal(response.status, 410);
    assert.equal(requireFreshAdminSession.mock.callCount(), 0);
  });
});

test('metadata artist import route does not invoke the admin session guard', async (t) => {
  // Regression guard: if the route regresses back to requireFreshAdminSession,
  // this mock would throw and the test would fail.
  const requireFreshAdminSession = t.mock.fn(async () => {
    throw Object.assign(new Error('Administrator access is required'), {
      status: 403,
      code: 'admin_required',
    });
  });
  const app = createMetadataRouteTestApp({ requireFreshAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/musicbrainz/artists/mb-artist-1/import`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
    });

    assert.equal(response.status, 201);
    assert.equal(requireFreshAdminSession.mock.callCount(), 0);
  });
});

test('metadata release-group tracklist route returns the shared tracklist payload', async (t) => {
  const getReleaseGroupTracklist = t.mock.fn(async () => ({
    release: { id: 'release-1', title: 'Substrata' },
    media: [{ position: 1, format: 'CD', tracks: [{ id: 'track-1', title: 'Poa Alpina', position: 1 }] }],
    ownership: { releaseId: 'release-1', ownedTrackCount: 1 },
    allReleases: [{ id: 'release-1', title: 'Substrata', isCanonical: true }],
    requestState: { releaseGroupId: 'rg-1' },
    source: 'local',
  }));
  const app = createMetadataRouteTestApp({ getReleaseGroupTracklist });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/v1/metadata/musicbrainz/release-groups/mb-rg-1/tracklist?preferReleaseMbid=mb-release-1`,
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(getReleaseGroupTracklist.mock.callCount(), 1);
    assert.deepEqual(getReleaseGroupTracklist.mock.calls[0].arguments[0], {
      releaseGroupMbid: 'mb-rg-1',
      preferReleaseMbid: 'mb-release-1',
      preferReleaseId: null,
      sessionUserId: 'user-1',
    });
    assert.deepEqual(payload, {
      ok: true,
      release: { id: 'release-1', title: 'Substrata' },
      media: [{ position: 1, format: 'CD', tracks: [{ id: 'track-1', title: 'Poa Alpina', position: 1 }] }],
      ownership: { releaseId: 'release-1', ownedTrackCount: 1 },
      allReleases: [{ id: 'release-1', title: 'Substrata', isCanonical: true }],
      requestState: { releaseGroupId: 'rg-1' },
      source: 'local',
    });
  });
});

test('metadata canonical release patch route returns the shared canonical selection payload', async (t) => {
  const markCanonicalRelease = t.mock.fn(async (releaseId) => ({
    releaseGroupId: 'rg-1',
  }));
  const requireCsrf = t.mock.fn();
  const requireFreshAdminSession = t.mock.fn(async () => ({
    appUserId: 'user-admin',
    csrfToken: 'csrf-token',
    csrfTokenHash: 'hashed',
    user: { role: 'admin' },
  }));
  const app = createMetadataRouteTestApp({ markCanonicalRelease, requireCsrf, requireFreshAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/releases/release-7/canonical`, {
      method: 'PATCH',
      headers: { 'x-csrf-token': 'csrf-token' },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(markCanonicalRelease.mock.callCount(), 1);
    assert.deepEqual(markCanonicalRelease.mock.calls[0].arguments, ['release-7']);
    assert.deepEqual(payload, { ok: true, releaseId: 'release-7', releaseGroupId: 'rg-1' });
  });
});

test('metadata canonical release patch route returns 404 when markCanonicalRelease returns null', async () => {
  const app = createMetadataRouteTestApp({
    markCanonicalRelease: async () => null,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/releases/missing-release/canonical`, {
      method: 'PATCH',
      headers: { 'x-csrf-token': 'csrf-token' },
    });
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'metadata_not_found',
        message: 'Release not found: missing-release',
      },
    });
  });
});

test('metadata similar artists route returns shared similar payload with sanitized limit', async (t) => {
  const getSimilarArtists = t.mock.fn(async ({ artistMbid, limit }) => ({
    cache: { lookup: 'fresh', refresh: 'none', refreshDurationMs: null, state: 'fresh' },
    similar: [{ mbid: 'mb-1', name: 'Similar Artist', score: 0.9 }],
  }));
  const app = createMetadataRouteTestApp({ getSimilarArtists });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/artists/test-mbid/similar?limit=abc`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.cache, { lookup: 'fresh', refresh: 'none', refreshDurationMs: null, state: 'fresh' });
    assert.equal(payload.similar.length, 1);
    const callArgs = getSimilarArtists.mock.calls[0].arguments[0];
    assert.equal(callArgs.artistMbid, 'test-mbid');
    assert.equal(callArgs.limit, 20);
  });
});
