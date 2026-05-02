import assert from 'node:assert/strict';
import test from 'node:test';
import { createSpotifyOAuthService } from '../../src/server/integrations/spotify/spotify-oauth-service.js';

function createMemoryEncryptedSecretService() {
  const secrets = new Map();

  return {
    clearSecretValue: async ({ name }) => {
      secrets.delete(name);
    },
    getSecretMetadata: async ({ name }) => ({
      configured: secrets.has(name),
      updatedAt: secrets.get(name)?.updatedAt ?? null,
    }),
    getSecretRecord: async ({ name }) => secrets.get(name) ?? null,
    getSecretValue: async ({ name }) => secrets.get(name)?.plaintextValue ?? null,
    secrets,
    setSecretValue: async ({ metadata, name, plaintextValue }) => {
      secrets.set(name, {
        metadata,
        plaintextValue,
        updatedAt: '2026-05-02T12:00:00.000Z',
      });
    },
  };
}

function createSettings() {
  return {
    providers: {
      spotifyClientId: 'spotify-client',
    },
    system: {
      baseUrl: 'https://harmoniarr.example',
    },
  };
}

test('startAuthorization stores PKCE state and returns Spotify authorize URL', async (t) => {
  const encryptedSecretService = createMemoryEncryptedSecretService();
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createSpotifyOAuthService({
    encryptedSecretService,
    getNow: () => new Date('2026-05-02T12:00:00.000Z'),
    loadSettingsFn: async () => createSettings(),
    recordAuditEventFn,
  });

  const result = await service.startAuthorization({
    actorUserId: 'user-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
  });
  const authorizeUrl = new URL(result.authorizationUrl);

  assert.equal(authorizeUrl.origin, 'https://accounts.spotify.com');
  assert.equal(authorizeUrl.pathname, '/authorize');
  assert.equal(authorizeUrl.searchParams.get('client_id'), 'spotify-client');
  assert.equal(authorizeUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorizeUrl.searchParams.get('redirect_uri'), 'https://harmoniarr.example/api/v1/providers/spotify/oauth/callback');
  assert.equal(authorizeUrl.searchParams.get('scope'), 'playlist-read-private playlist-read-collaborative');
  assert.equal(result.expiresAt, '2026-05-02T12:10:00.000Z');
  assert.equal(encryptedSecretService.secrets.size, 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
});

test('completeAuthorization exchanges callback code and stores encrypted token payload', async (t) => {
  const encryptedSecretService = createMemoryEncryptedSecretService();
  const fetchFn = t.mock.fn(async () => new Response(JSON.stringify({
    access_token: 'access-token',
    expires_in: 3600,
    refresh_token: 'refresh-token',
    scope: 'playlist-read-private playlist-read-collaborative',
    token_type: 'Bearer',
  }), { status: 200 }));
  const service = createSpotifyOAuthService({
    encryptedSecretService,
    fetchFn,
    getNow: () => new Date('2026-05-02T12:00:00.000Z'),
    getPoolFn: () => ({}),
    loadSettingsFn: async () => createSettings(),
    recordAuditEventFn: t.mock.fn(async () => {}),
  });

  const started = await service.startAuthorization({ actorUserId: 'user-1' });
  const state = new URL(started.authorizationUrl).searchParams.get('state');
  const result = await service.completeAuthorization({ code: 'callback-code', state });

  assert.equal(result.status.linked, true);
  assert.equal(result.status.tokenExpiresAt, '2026-05-02T13:00:00.000Z');
  assert.equal(fetchFn.mock.callCount(), 1);
  const tokenRequest = fetchFn.mock.calls[0].arguments;
  assert.equal(tokenRequest[0], 'https://accounts.spotify.com/api/token');
  assert.equal(tokenRequest[1].method, 'POST');
  assert.match(String(tokenRequest[1].body), /grant_type=authorization_code/);
  assert.match(String(tokenRequest[1].body), /code=callback-code/);
  assert.equal(encryptedSecretService.secrets.has('providers.spotify.oauth.token'), true);
  assert.equal([...encryptedSecretService.secrets.keys()].some((name) => name.startsWith('providers.spotify.oauth.pending.')), false);
});

test('resolveAccessToken refreshes expired tokens and preserves refresh token when Spotify omits a new one', async (t) => {
  const encryptedSecretService = createMemoryEncryptedSecretService();
  await encryptedSecretService.setSecretValue({
    metadata: { expiresAt: '2026-05-02T11:59:00.000Z', tokenType: 'Bearer' },
    name: 'providers.spotify.oauth.token',
    plaintextValue: JSON.stringify({
      accessToken: 'old-access-token',
      expiresAt: '2026-05-02T11:59:00.000Z',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
    }),
  });
  const fetchFn = t.mock.fn(async () => new Response(JSON.stringify({
    access_token: 'new-access-token',
    expires_in: 3600,
    token_type: 'Bearer',
  }), { status: 200 }));
  const service = createSpotifyOAuthService({
    encryptedSecretService,
    fetchFn,
    getNow: () => new Date('2026-05-02T12:00:00.000Z'),
    loadSettingsFn: async () => createSettings(),
  });

  const accessToken = await service.resolveAccessToken({});
  const storedToken = JSON.parse(encryptedSecretService.secrets.get('providers.spotify.oauth.token').plaintextValue);

  assert.equal(accessToken, 'new-access-token');
  assert.equal(storedToken.refreshToken, 'refresh-token');
  assert.equal(fetchFn.mock.callCount(), 1);
  assert.match(String(fetchFn.mock.calls[0].arguments[1].body), /grant_type=refresh_token/);
});
