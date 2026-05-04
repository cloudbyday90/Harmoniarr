import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlexOwnerLinkService } from '../../src/server/integrations/plex/plex-owner-link-service.js';

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
        updatedAt: '2026-05-03T12:00:00.000Z',
      });
    },
  };
}

test('createPlexOwnerLinkService startLink stores pending state and returns a Plex authorization URL', async (t) => {
  const encryptedSecretService = createMemoryEncryptedSecretService();
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createPlexOwnerLinkService({
    encryptedSecretService,
    getNow: () => new Date('2026-05-03T12:00:00.000Z'),
    loadSettingsFn: async () => ({
      system: {
        baseUrl: 'https://harmoniarr.example',
      },
    }),
    plexHttpClient: {
      createPin: t.mock.fn(async () => ({
        code: 'pin-code-123',
        id: 42,
      })),
    },
    recordAuditEventFn,
  });

  const result = await service.startLink({
    actorUserId: 'admin-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
  });

  assert.equal(result.provider, 'plex');
  assert.equal(result.expiresAt, '2026-05-03T12:10:00.000Z');
  assert.match(result.authorizationUrl, /^https:\/\/app\.plex\.tv\/auth#\?/);
  assert.match(result.authorizationUrl, /code=pin-code-123/);
  assert.match(result.authorizationUrl, /forwardUrl=https%3A%2F%2Fharmoniarr\.example%2Fapi%2Fv1%2Fproviders%2Fplex%2Flink%2Fcallback/);
  assert.equal(encryptedSecretService.secrets.has('providers.plex.link.client_identifier'), true);
  assert.equal(
    [...encryptedSecretService.secrets.keys()].some((name) => name.startsWith('providers.plex.link.pending.')),
    true,
  );
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
});

test('createPlexOwnerLinkService completeLink stores the linked token payload and clears pending state', async (t) => {
  const encryptedSecretService = createMemoryEncryptedSecretService();
  const plexHttpClient = {
    createPin: t.mock.fn(async () => ({
      code: 'pin-code-123',
      id: 42,
    })),
    fetchCurrentUser: t.mock.fn(async () => ({
      email: 'Owner@example.com',
      id: 7,
      thumb: 'https://plex.example/thumb.jpg',
      title: 'Owner Account',
      username: 'Owner.Admin',
      uuid: 'plex-owner-uuid',
    })),
    readPin: t.mock.fn(async () => ({
      authToken: 'plex-access-token',
    })),
  };
  const service = createPlexOwnerLinkService({
    encryptedSecretService,
    getNow: () => new Date('2026-05-03T12:00:00.000Z'),
    loadSettingsFn: async () => ({
      system: {
        baseUrl: 'https://harmoniarr.example',
      },
    }),
    plexHttpClient,
    recordAuditEventFn: t.mock.fn(async () => {}),
  });

  const started = await service.startLink({ actorUserId: 'admin-1' });
  const state = new URL(started.authorizationUrl.replace('https://app.plex.tv/auth#?', 'https://app.plex.tv/auth?')).searchParams.get('forwardUrl');
  const callbackUrl = new URL(state);
  const callbackState = callbackUrl.searchParams.get('state');

  const result = await service.completeLink({
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
    state: callbackState,
  });

  assert.equal(result.provider, 'plex');
  assert.equal(result.status.linked, true);
  assert.equal(result.status.linkedUserEmail, 'owner@example.com');
  assert.equal(result.status.linkedUsername, 'owner.admin');
  assert.equal(encryptedSecretService.secrets.has('providers.plex.link.token'), true);
  assert.equal(
    [...encryptedSecretService.secrets.keys()].some((name) => name.startsWith('providers.plex.link.pending.')),
    false,
  );
  assert.equal(plexHttpClient.readPin.mock.callCount(), 1);
  assert.equal(plexHttpClient.fetchCurrentUser.mock.callCount(), 1);
});

test('createPlexOwnerLinkService clearLink removes the stored token payload', async () => {
  const encryptedSecretService = createMemoryEncryptedSecretService();
  await encryptedSecretService.setSecretValue({
    metadata: { linkedAt: '2026-05-03T12:00:00.000Z' },
    name: 'providers.plex.link.token',
    plaintextValue: JSON.stringify({
      accessToken: 'plex-access-token',
      clientIdentifier: 'plex-client-id',
    }),
  });
  const service = createPlexOwnerLinkService({
    encryptedSecretService,
    recordAuditEventFn: async () => {},
  });

  const result = await service.clearLink({
    actorUserId: 'admin-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
  });

  assert.equal(result.provider, 'plex');
  assert.equal(result.status.linked, false);
  assert.equal(encryptedSecretService.secrets.has('providers.plex.link.token'), false);
});
