import assert from 'node:assert/strict';
import test from 'node:test';
import { registerProviderRoutes } from '../../src/server/routes/provider-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createProviderRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerProviderRoutes(app, {
      buildAppleMusicStatus: async () => ({
        configured: false,
        provider: 'apple_music',
        storefront: 'us',
        teamIdConfigured: false,
        keyIdConfigured: false,
        privateKeyConfigured: false,
      }),
      buildSpotifyOAuthStatus: async () => ({
        linked: false,
        scope: null,
        tokenExpiresAt: null,
        tokenType: null,
        updatedAt: null,
      }),
      buildYoutubeOAuthStatus: async () => ({
        linked: false,
        scope: null,
        tokenExpiresAt: null,
        tokenType: null,
        updatedAt: null,
      }),
      clearSpotifyAuthorization: async () => ({
        provider: 'spotify',
        status: { linked: false },
      }),
      clearYoutubeAuthorization: async () => ({
        provider: 'youtube',
        status: { linked: false },
      }),
      completeSpotifyAuthorization: async () => ({ provider: 'spotify' }),
      completeYoutubeAuthorization: async () => ({ provider: 'youtube' }),
      getRequestMetadata: (request) => ({
        ipAddress: request.headers['x-forwarded-for'] ?? '127.0.0.1',
        userAgent: request.headers['user-agent'] ?? null,
      }),
      requireCsrf: () => {},
      requireFreshAdminSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token' }),
      requireSession: async () => ({ appUserId: 'user-1', user: { role: 'admin' } }),
      startSpotifyAuthorization: async ({ actorUserId, requestMetadata }) => ({
        authorizationUrl: `https://accounts.spotify.com/authorize?actor=${actorUserId}&origin=${encodeURIComponent(requestMetadata.origin)}`,
        expiresAt: '2026-05-02T12:10:00.000Z',
        provider: 'spotify',
        scopes: ['playlist-read-private'],
      }),
      startYoutubeAuthorization: async ({ actorUserId, requestMetadata }) => ({
        authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?actor=${actorUserId}&origin=${encodeURIComponent(requestMetadata.origin)}`,
        expiresAt: '2026-05-02T12:10:00.000Z',
        provider: 'youtube',
        scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
      }),
      ...overrides,
    });
  });
}

test('GET /api/v1/providers/status returns unified provider status', async () => {
  const app = createProviderRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/providers/status`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.spotify.linked, false);
    assert.equal(body.youtube.linked, false);
    assert.equal(body.appleMusic.configured, false);
    assert.equal(body.appleMusic.provider, 'apple_music');
    assert.equal(body.appleMusic.storefront, 'us');
  });
});

test('POST /api/v1/providers/spotify/oauth/start returns authorization URL with request origin', async () => {
  const app = createProviderRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/providers/spotify/oauth/start`, {
      headers: {
        'x-forwarded-host': 'music.example.test',
        'x-forwarded-proto': 'https',
      },
      method: 'POST',
    });
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.ok, true);
    assert.equal(body.provider, 'spotify');
    assert.match(body.authorizationUrl, /https%3A%2F%2Fmusic\.example\.test/);
  });
});

test('POST /api/v1/providers/youtube/oauth/start returns authorization URL with request origin', async () => {
  const app = createProviderRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/providers/youtube/oauth/start`, {
      headers: {
        'x-forwarded-host': 'music.example.test',
        'x-forwarded-proto': 'https',
      },
      method: 'POST',
    });
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.ok, true);
    assert.equal(body.provider, 'youtube');
    assert.match(body.authorizationUrl, /https%3A%2F%2Fmusic\.example\.test/);
  });
});

test('GET /api/v1/providers/spotify/oauth/callback completes callback and redirects to settings', async () => {
  const app = createProviderRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/providers/spotify/oauth/callback?code=code-1&state=state-1`, {
      redirect: 'manual',
    });

    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/app/settings?spotifyOAuth=linked');
  });
});

test('GET /api/v1/providers/youtube/oauth/callback completes callback and redirects to settings', async () => {
  const app = createProviderRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/providers/youtube/oauth/callback?code=code-1&state=state-1`, {
      redirect: 'manual',
    });

    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/app/settings?youtubeOAuth=linked');
  });
});

test('POST /api/v1/providers/spotify/oauth/clear clears linked Spotify authorization', async () => {
  const app = createProviderRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/providers/spotify/oauth/clear`, {
      method: 'POST',
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.deepEqual(body.status, { linked: false });
  });
});

test('POST /api/v1/providers/youtube/oauth/clear clears linked YouTube authorization', async () => {
  const app = createProviderRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/providers/youtube/oauth/clear`, {
      method: 'POST',
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.deepEqual(body.status, { linked: false });
  });
});
