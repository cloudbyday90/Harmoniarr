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
      getMetadataArtistByMusicBrainzId: async ({ musicBrainzArtistId }) => ({
        artist: { id: 'local-artist-1', source: { musicbrainzArtistId: musicBrainzArtistId } },
        aliases: [],
        monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album', 'ep'] },
        releaseGroups: [],
        releases: [],
      }),
      getMetadataRelease: async () => ({ artist: null, releaseGroup: null, release: null, media: [] }),
      getMetadataReleaseByMusicBrainzId: async () => ({ artist: null, releaseGroup: null, release: null, media: [] }),
      getMetadataReleaseGroup: async () => ({ artist: null, releaseGroup: null, releases: [] }),
      getMetadataReleaseGroupByMusicBrainzId: async () => ({ artist: null, releaseGroup: null, releases: [] }),
      importMusicBrainzArtist: async ({ artistId, actorUserId, requestMetadata }) => ({
        artist: { id: `local-${artistId}` },
        source: { actorUserId, requestMetadata },
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
      updateMetadataArtistMonitoring: async ({ metadataArtistId, patch }) => ({
        artistId: metadataArtistId,
        monitoring: {
          isMonitored: patch.isMonitored,
          monitoredReleaseGroupTypes: patch.monitoredReleaseGroupTypes,
        },
      }),
      requireCsrf: () => {},
      requireSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', csrfTokenHash: 'hashed' }),
      searchLocalMetadataArtists: async ({ query, limit }) => ({ query, limit: Number(limit), results: [{ id: 'artist-1', name: query }] }),
      searchLocalMetadataReleaseGroups: async ({ query, limit }) => ({ query, limit: Number(limit), results: [{ id: 'rg-1', title: query }] }),
      searchLocalMetadataReleases: async ({ query, limit }) => ({ query, limit: Number(limit), results: [{ id: 'release-1', title: query }] }),
      searchMusicBrainzArtists: async () => ({ results: [] }),
      searchMusicBrainzReleases: async () => ({ results: [] }),
      ...overrides,
    });
  });
}

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

test('metadata local artist read route returns the local canonical payload', async () => {
  const app = createMetadataRouteTestApp({
    getMetadataArtist: async ({ artistId }) => ({
      artist: { id: artistId, name: 'Boards of Canada' },
      aliases: [{ id: 'alias-1', name: 'BoC' }],
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
      monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album'] },
      releaseGroups: [{ id: 'rg-1', title: 'Music Has the Right to Children' }],
      releases: [{ id: 'release-1', title: 'Geogaddi' }],
    });
  });
});

test('metadata artist monitoring route updates the shared monitoring payload', async (t) => {
  const updateMetadataArtistMonitoring = t.mock.fn(async ({ metadataArtistId, patch }) => ({
    artistId: metadataArtistId,
    monitoring: {
      isMonitored: patch.isMonitored,
      monitoredReleaseGroupTypes: patch.monitoredReleaseGroupTypes,
    },
  }));
  const requireCsrf = t.mock.fn();
  const app = createMetadataRouteTestApp({
    requireCsrf,
    updateMetadataArtistMonitoring,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/metadata/artists/local-artist-1/monitoring`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album'],
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(updateMetadataArtistMonitoring.mock.calls[0].arguments[0], {
      metadataArtistId: 'local-artist-1',
      patch: {
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album'],
      },
    });
    assert.deepEqual(payload, {
      ok: true,
      artistId: 'local-artist-1',
      monitoring: {
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album'],
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
      limit: '5',
      offset: '10',
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

  const app = createMetadataRouteTestApp({
    importMusicBrainzArtist,
    requireCsrf,
    requireSession: async () => ({ appUserId: 'user-9', csrfToken: 'csrf-token', csrfTokenHash: 'hashed' }),
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

  const app = createMetadataRouteTestApp({
    importMusicBrainzRelease,
    requireSession: async () => ({ appUserId: 'user-11', csrfToken: 'csrf-token', csrfTokenHash: 'hashed' }),
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