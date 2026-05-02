import assert from 'node:assert/strict';
import test from 'node:test';
import { createYouTubeOAuthService } from '../../src/server/integrations/youtube/youtube-oauth-service.js';

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
      youtubeClientId: 'youtube-client',
    },
    system: {
      baseUrl: 'https://harmoniarr.example',
    },
  };
}

function createProviderCredentialsService() {
  return {
    resolveYoutubeClientSecret: async () => 'youtube-secret',
  };
}

test('startAuthorization stores PKCE state and returns YouTube authorize URL', async (t) => {
  const encryptedSecretService = createMemoryEncryptedSecretService();
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createYouTubeOAuthService({
    encryptedSecretService,
    getNow: () => new Date('2026-05-02T12:00:00.000Z'),
    getPoolFn: () => ({}),
    loadSettingsFn: async () => createSettings(),
    providerCredentialsService: createProviderCredentialsService(),
    recordAuditEventFn,
  });

  const result = await service.startAuthorization({
    actorUserId: 'user-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
  });
  const authorizeUrl = new URL(result.authorizationUrl);

  assert.equal(authorizeUrl.origin, 'https://accounts.google.com');
  assert.equal(authorizeUrl.pathname, '/o/oauth2/v2/auth');
  assert.equal(authorizeUrl.searchParams.get('access_type'), 'offline');
  assert.equal(authorizeUrl.searchParams.get('client_id'), 'youtube-client');
  assert.equal(authorizeUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorizeUrl.searchParams.get('include_granted_scopes'), 'true');
  assert.equal(authorizeUrl.searchParams.get('prompt'), 'consent');
  assert.equal(authorizeUrl.searchParams.get('redirect_uri'), 'https://harmoniarr.example/api/v1/providers/youtube/oauth/callback');
  assert.equal(authorizeUrl.searchParams.get('scope'), 'https://www.googleapis.com/auth/youtube.readonly');
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
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    token_type: 'Bearer',
  }), { status: 200 }));
  const service = createYouTubeOAuthService({
    encryptedSecretService,
    fetchFn,
    getNow: () => new Date('2026-05-02T12:00:00.000Z'),
    getPoolFn: () => ({}),
    loadSettingsFn: async () => createSettings(),
    providerCredentialsService: createProviderCredentialsService(),
    recordAuditEventFn: t.mock.fn(async () => {}),
  });

  const started = await service.startAuthorization({ actorUserId: 'user-1' });
  const state = new URL(started.authorizationUrl).searchParams.get('state');
  const result = await service.completeAuthorization({ code: 'callback-code', state });

  assert.equal(result.status.linked, true);
  assert.equal(result.status.tokenExpiresAt, '2026-05-02T13:00:00.000Z');
  assert.equal(fetchFn.mock.callCount(), 1);
  const tokenRequest = fetchFn.mock.calls[0].arguments;
  assert.equal(tokenRequest[0], 'https://oauth2.googleapis.com/token');
  assert.equal(tokenRequest[1].method, 'POST');
  assert.match(String(tokenRequest[1].body), /grant_type=authorization_code/);
  assert.match(String(tokenRequest[1].body), /code=callback-code/);
  assert.match(String(tokenRequest[1].body), /client_secret=youtube-secret/);
  assert.equal(encryptedSecretService.secrets.has('providers.youtube.oauth.token'), true);
  assert.equal([...encryptedSecretService.secrets.keys()].some((name) => name.startsWith('providers.youtube.oauth.pending.')), false);
});

test('resolveAccessToken refreshes expired tokens and preserves refresh token when Google omits a new one', async (t) => {
  const encryptedSecretService = createMemoryEncryptedSecretService();
  await encryptedSecretService.setSecretValue({
    metadata: { expiresAt: '2026-05-02T11:59:00.000Z', tokenType: 'Bearer' },
    name: 'providers.youtube.oauth.token',
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
  const service = createYouTubeOAuthService({
    encryptedSecretService,
    fetchFn,
    getNow: () => new Date('2026-05-02T12:00:00.000Z'),
    loadSettingsFn: async () => createSettings(),
    providerCredentialsService: createProviderCredentialsService(),
  });

  const accessToken = await service.resolveAccessToken({});
  const storedToken = JSON.parse(encryptedSecretService.secrets.get('providers.youtube.oauth.token').plaintextValue);

  assert.equal(accessToken, 'new-access-token');
  assert.equal(storedToken.refreshToken, 'refresh-token');
  assert.equal(fetchFn.mock.callCount(), 1);
  assert.match(String(fetchFn.mock.calls[0].arguments[1].body), /grant_type=refresh_token/);
  assert.match(String(fetchFn.mock.calls[0].arguments[1].body), /client_secret=youtube-secret/);
});
