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
      buildPlexLinkStatus: async () => ({
        linked: false,
        linkedAt: null,
        linkedUserEmail: null,
        linkedUserId: null,
        linkedUserTitle: null,
        linkedUsername: null,
        linkedUserUuid: null,
        thumbUrl: null,
        updatedAt: null,
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
      clearPlexLink: async () => ({
        provider: 'plex',
        status: { linked: false },
      }),
      clearSpotifyAuthorization: async () => ({
        provider: 'spotify',
        status: { linked: false },
      }),
      clearYoutubeAuthorization: async () => ({
        provider: 'youtube',
        status: { linked: false },
      }),
      completePlexLink: async () => ({ provider: 'plex' }),
      completeSpotifyAuthorization: async () => ({ provider: 'spotify' }),
      completeYoutubeAuthorization: async () => ({ provider: 'youtube' }),
      getRequestMetadata: (request) => ({
        ipAddress: request.headers['x-forwarded-for'] ?? '127.0.0.1',
        userAgent: request.headers['user-agent'] ?? null,
      }),
      requireCsrf: () => {},
      requireFreshAdminSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token' }),
      requireSession: async () => ({ appUserId: 'user-1', user: { role: 'admin' } }),
      startPlexLink: async ({ actorUserId, requestMetadata }) => ({
        authorizationUrl: `https://app.plex.tv/auth#?actor=${actorUserId}&origin=${encodeURIComponent(requestMetadata.origin)}`,
        expiresAt: '2026-05-02T12:10:00.000Z',
        provider: 'plex',
      }),
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
    assert.equal(body.plex.linked, false);
    assert.equal(body.spotify.linked, false);
    assert.equal(body.youtube.linked, false);
    assert.equal(body.appleMusic.configured, false);
    assert.equal(body.appleMusic.provider, 'apple_music');
    assert.equal(body.appleMusic.storefront, 'us');
  });
});

test('POST /api/v1/providers/plex/link/start returns authorization URL with request origin', async () => {
  const app = createProviderRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/providers/plex/link/start`, {
      headers: {
        'x-forwarded-host': 'music.example.test',
        'x-forwarded-proto': 'https',
      },
      method: 'POST',
    });
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.ok, true);
    assert.equal(body.provider, 'plex');
    assert.match(body.authorizationUrl, /https%3A%2F%2Fmusic\.example\.test/);
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
      headers: { cookie: 'harmoniarr_spotify_binding=' + Buffer.alloc(32, 1).toString('base64url') },
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
      headers: { cookie: 'harmoniarr_youtube_binding=' + Buffer.alloc(32, 1).toString('base64url') },
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

test('POST /api/v1/providers/plex/link/clear clears linked Plex authorization', async () => {
  const app = createProviderRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/providers/plex/link/clear`, {
      method: 'POST',
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.deepEqual(body.status, { linked: false });
  });
});

test('GET /api/v1/providers/plex/link/callback completes callback and redirects to settings', async () => {
  const app = createProviderRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/providers/plex/link/callback?state=state-1`, {
      headers: { cookie: 'harmoniarr_plex_link_binding=' + Buffer.alloc(32, 1).toString('base64url') },
      redirect: 'manual',
    });

    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/app/settings?plexOAuth=linked');
  });
});

test('Plex owner start exposes only its public DTO and passes current session with the browser verifier', async t => {
  const startPlexLink = t.mock.fn(async () => ({ provider: 'plex', authorizationUrl: 'https://app.plex.tv/auth', expiresAt: '2026-10-27T12:10:00.000Z', accessToken: 'must-not-leak', authority: { tokenHash: 'must-not-leak' } }));
  await withServer(createProviderRouteTestApp({ startPlexLink }), async baseUrl => {
    const response = await fetch(baseUrl + '/api/v1/providers/plex/link/start', { method: 'POST' });
    assert.equal(response.status, 202);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('set-cookie'), /harmoniarr_plex_link_binding=.*HttpOnly; SameSite=Lax/u);
    const body = await response.json(); assert.deepEqual(Object.keys(body).sort(), ['authorizationUrl', 'expiresAt', 'ok', 'provider']);
    const input = startPlexLink.mock.calls[0].arguments[0];
    assert.equal(input.session.appUserId, 'user-1'); assert.equal(input.browserBinding.length, 43);
    assert.ok(!JSON.stringify(body).includes(input.browserBinding));
  });
});

test('Plex owner callback requires its browser cookie before calling the completion owner', async t => {
  const completePlexLink = t.mock.fn(async () => ({}));
  await withServer(createProviderRouteTestApp({ completePlexLink }), async baseUrl => {
    const response = await fetch(baseUrl + '/api/v1/providers/plex/link/callback?state=missing', { redirect: 'manual' });
    assert.equal(response.status, 303); assert.match(response.headers.get('location'), /plex_link_state_invalid/u);
    assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(completePlexLink.mock.callCount(), 0); assert.equal(response.headers.get('set-cookie'), null);
  });
});

for (const [provider, title] of [['spotify', 'Spotify'], ['youtube', 'Youtube']]) {
  test(`${provider} OAuth start whitelists its DTO and supplies exact session/browser authority`, async t => {
    const start = t.mock.fn(async () => ({ provider, authorizationUrl: 'https://provider.example/authorize', expiresAt: '2026-10-27T12:10:00.000Z', scopes: ['read'], accessToken: 'must-not-leak' }));
    await withServer(createProviderRouteTestApp({ ['start' + title + 'Authorization']: start }), async baseUrl => {
      const response = await fetch(baseUrl + '/api/v1/providers/' + provider + '/oauth/start', { method: 'POST' });
      assert.equal(response.status, 202); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      assert.match(response.headers.get('set-cookie'), new RegExp(`harmoniarr_${provider}_binding=.*HttpOnly; SameSite=Lax`, 'u'));
      const body = await response.json(); assert.deepEqual(Object.keys(body).sort(), ['authorizationUrl', 'expiresAt', 'ok', 'provider', 'scopes']);
      const input = start.mock.calls[0].arguments[0]; assert.equal(input.session.appUserId, 'user-1'); assert.equal(input.browserBinding.length, 43); assert.ok(!JSON.stringify(body).includes(input.browserBinding));
    });
  });
  test(`${provider} OAuth callback refuses a missing provider binding before completion`, async t => {
    const complete = t.mock.fn(async () => ({}));
    await withServer(createProviderRouteTestApp({ ['complete' + title + 'Authorization']: complete }), async baseUrl => {
      const response = await fetch(baseUrl + '/api/v1/providers/' + provider + '/oauth/callback?code=code&state=state', { redirect: 'manual' });
      assert.equal(response.status, 303); assert.match(response.headers.get('location'), new RegExp(provider + '_oauth_state_invalid', 'u'));
      assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('set-cookie'), null); assert.equal(complete.mock.callCount(), 0);
    });
  });
}
