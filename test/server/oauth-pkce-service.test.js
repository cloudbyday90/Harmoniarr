import assert from 'node:assert/strict';
import test from 'node:test';
import { createOAuthPKCEService } from '../../src/server/integrations/providers/oauth-pkce-service.js';

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

function createTestServiceConfig(overrides = {}) {
  const encryptedSecretService = overrides.encryptedSecretService ?? createMemoryEncryptedSecretService();
  const settings = {
    providers: { testClientId: 'test-client' },
    system: { baseUrl: 'https://harmoniarr.example' },
  };

  return {
    authorizeUrl: 'https://auth.example.com/authorize',
    callbackPath: '/api/v1/providers/test/oauth/callback',
    clientIdSettingKey: 'testClientId',
    defaultScopes: ['read', 'write'],
    encryptedSecretService,
    fetchFn: overrides.fetchFn ?? globalThis.fetch,
    getNow: overrides.getNow ?? (() => new Date('2026-05-02T12:00:00.000Z')),
    getPoolFn: () => ({}),
    loadSettingsFn: async () => settings,
    providerLabel: 'Test',
    providerPrefix: 'test',
    recordAuditEventFn: overrides.recordAuditEventFn ?? (async () => {}),
    resolveClientCredentials: overrides.resolveClientCredentials ?? (async () => ({ clientId: 'test-client' })),
    tokenUrl: 'https://auth.example.com/token',
  };
}

test('startAuthorization stores PKCE state and returns authorization URL', async (t) => {
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createOAuthPKCEService(createTestServiceConfig({ recordAuditEventFn }));

  const result = await service.startAuthorization({
    actorUserId: 'user-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
  });
  const authorizeUrl = new URL(result.authorizationUrl);

  assert.equal(authorizeUrl.origin, 'https://auth.example.com');
  assert.equal(authorizeUrl.pathname, '/authorize');
  assert.equal(authorizeUrl.searchParams.get('client_id'), 'test-client');
  assert.equal(authorizeUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorizeUrl.searchParams.get('redirect_uri'), 'https://harmoniarr.example/api/v1/providers/test/oauth/callback');
  assert.equal(authorizeUrl.searchParams.get('scope'), 'read write');
  assert.equal(authorizeUrl.searchParams.get('response_type'), 'code');
  assert.equal(result.provider, 'test');
  assert.equal(result.scopes.length, 2);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
});

test('completeAuthorization exchanges code and stores encrypted token', async (t) => {
  const fetchFn = t.mock.fn(async () => new Response(JSON.stringify({
    access_token: 'access-token',
    expires_in: 3600,
    refresh_token: 'refresh-token',
    scope: 'read write',
    token_type: 'Bearer',
  }), { status: 200 }));
  const config = createTestServiceConfig({ fetchFn });
  const service = createOAuthPKCEService(config);

  const started = await service.startAuthorization({ actorUserId: 'user-1' });
  const state = new URL(started.authorizationUrl).searchParams.get('state');
  const result = await service.completeAuthorization({ code: 'callback-code', state });

  assert.equal(result.status.linked, true);
  assert.equal(result.status.tokenExpiresAt, '2026-05-02T13:00:00.000Z');
  assert.equal(fetchFn.mock.callCount(), 1);
  assert.match(String(fetchFn.mock.calls[0].arguments[1].body), /grant_type=authorization_code/);
  assert.match(String(fetchFn.mock.calls[0].arguments[1].body), /code=callback-code/);
  assert.equal(config.encryptedSecretService.secrets.has('providers.test.oauth.token'), true);
});

test('resolveAccessToken refreshes expired tokens and preserves refresh token', async (t) => {
  const encryptedSecretService = createMemoryEncryptedSecretService();
  await encryptedSecretService.setSecretValue({
    metadata: { expiresAt: '2026-05-02T11:59:00.000Z', tokenType: 'Bearer' },
    name: 'providers.test.oauth.token',
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
  const service = createOAuthPKCEService(createTestServiceConfig({ encryptedSecretService, fetchFn }));

  const accessToken = await service.resolveAccessToken({});
  const storedToken = JSON.parse(encryptedSecretService.secrets.get('providers.test.oauth.token').plaintextValue);

  assert.equal(accessToken, 'new-access-token');
  assert.equal(storedToken.refreshToken, 'refresh-token');
  assert.equal(fetchFn.mock.callCount(), 1);
  assert.match(String(fetchFn.mock.calls[0].arguments[1].body), /grant_type=refresh_token/);
});

test('resolveAccessToken returns null when no token is stored', async () => {
  const service = createOAuthPKCEService(createTestServiceConfig());
  const accessToken = await service.resolveAccessToken({});
  assert.equal(accessToken, null);
});

test('clearAuthorization removes stored token', async () => {
  const encryptedSecretService = createMemoryEncryptedSecretService();
  await encryptedSecretService.setSecretValue({
    metadata: {},
    name: 'providers.test.oauth.token',
    plaintextValue: JSON.stringify({ accessToken: 'token', refreshToken: 'refresh' }),
  });
  const service = createOAuthPKCEService(createTestServiceConfig({ encryptedSecretService }));

  const result = await service.clearAuthorization({
    actorUserId: 'user-1',
    requestMetadata: {},
  });

  assert.equal(result.provider, 'test');
  assert.equal(result.status.linked, false);
  assert.equal(encryptedSecretService.secrets.has('providers.test.oauth.token'), false);
});

test('completeAuthorization rejects expired state', async (t) => {
  const fetchFn = t.mock.fn(async () => new Response(JSON.stringify({})));
  const startTime = new Date('2026-05-02T12:00:00.000Z');
  const laterTime = new Date('2026-05-02T12:20:00.000Z');
  let currentTime = startTime;

  const config = createTestServiceConfig({
    fetchFn,
    getNow: () => currentTime,
  });
  const service = createOAuthPKCEService(config);

  const started = await service.startAuthorization({ actorUserId: 'user-1' });
  const state = new URL(started.authorizationUrl).searchParams.get('state');

  currentTime = laterTime;

  await assert.rejects(
    () => service.completeAuthorization({ code: 'code', state }),
    { code: 'test_oauth_state_expired' },
  );
  assert.equal(fetchFn.mock.callCount(), 0);
});

test('completeAuthorization includes extra auth params from resolveClientCredentials', async (t) => {
  const fetchFn = t.mock.fn(async () => new Response(JSON.stringify({
    access_token: 'token',
    expires_in: 3600,
    refresh_token: 'refresh',
    token_type: 'Bearer',
  }), { status: 200 }));
  const config = createTestServiceConfig({
    fetchFn,
    resolveClientCredentials: async () => ({
      clientId: 'test-client',
      extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    }),
  });
  const service = createOAuthPKCEService(config);

  const started = await service.startAuthorization({ actorUserId: 'user-1' });
  const authorizeUrl = new URL(started.authorizationUrl);

  assert.equal(authorizeUrl.searchParams.get('access_type'), 'offline');
  assert.equal(authorizeUrl.searchParams.get('prompt'), 'consent');
});

test('completeAuthorization includes extra token params from resolveClientCredentials', async (t) => {
  const fetchFn = t.mock.fn(async () => new Response(JSON.stringify({
    access_token: 'token',
    expires_in: 3600,
    refresh_token: 'refresh',
    token_type: 'Bearer',
  }), { status: 200 }));
  const config = createTestServiceConfig({
    fetchFn,
    resolveClientCredentials: async () => ({
      clientId: 'test-client',
      extraTokenParams: { client_secret: 'secret' },
    }),
  });
  const service = createOAuthPKCEService(config);

  const started = await service.startAuthorization({ actorUserId: 'user-1' });
  const state = new URL(started.authorizationUrl).searchParams.get('state');
  await service.completeAuthorization({ code: 'code', state });

  const tokenBody = String(fetchFn.mock.calls[0].arguments[1].body);
  assert.match(tokenBody, /client_secret=secret/);
});

test('resolveAccessToken includes extra refresh params from resolveClientCredentials', async (t) => {
  const encryptedSecretService = createMemoryEncryptedSecretService();
  await encryptedSecretService.setSecretValue({
    metadata: { expiresAt: '2026-05-02T11:59:00.000Z' },
    name: 'providers.test.oauth.token',
    plaintextValue: JSON.stringify({
      accessToken: 'old',
      expiresAt: '2026-05-02T11:59:00.000Z',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
    }),
  });
  const fetchFn = t.mock.fn(async () => new Response(JSON.stringify({
    access_token: 'new',
    expires_in: 3600,
    token_type: 'Bearer',
  }), { status: 200 }));
  const service = createOAuthPKCEService(createTestServiceConfig({
    encryptedSecretService,
    fetchFn,
    resolveClientCredentials: async () => ({
      clientId: 'test-client',
      extraRefreshParams: { client_secret: 'secret' },
    }),
  }));

  await service.resolveAccessToken({});

  const refreshBody = String(fetchFn.mock.calls[0].arguments[1].body);
  assert.match(refreshBody, /grant_type=refresh_token/);
  assert.match(refreshBody, /client_secret=secret/);
});
