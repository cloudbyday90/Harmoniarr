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

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlexDirectSignInService } from '../../src/server/integrations/plex/plex-direct-sign-in-service.js';

function createEncryptedSecretServiceDouble() {
  const records = new Map();

  return {
    records,
    async clearSecretValue({ name }) {
      records.delete(name);
    },
    async getSecretValue({ name }) {
      return records.get(name) ?? null;
    },
    async setSecretValue({ name, plaintextValue }) {
      records.set(name, plaintextValue);
    },
  };
}

function getPendingStateName(secretService) {
  return [...secretService.records.keys()].find((key) => key.startsWith('auth.plex.sign_in.pending.')) ?? null;
}

function getPendingState(secretService) {
  const name = getPendingStateName(secretService);
  return name ? { name, value: JSON.parse(secretService.records.get(name)) } : null;
}

test('startSignIn creates a Plex auth URL and persists pending state', async () => {
  const encryptedSecretService = createEncryptedSecretServiceDouble();
  const service = createPlexDirectSignInService({
    encryptedSecretService,
    loadSettingsFn: async () => ({ system: { baseUrl: 'https://harmoniarr.example.test' } }),
    plexHttpClient: {
      async createPin() {
        return { code: 'PINCODE', id: 123 };
      },
    },
    recordAuditEventFn: async () => {},
  });

  const result = await service.startSignIn({
    redirectTo: '/app/activity/blocklist',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
  });

  assert.equal(result.provider, 'plex');
  assert.match(result.authorizationUrl, /^https:\/\/app\.plex\.tv\/auth#\?/);
  assert.equal(result.redirectTo, '/app/activity/blocklist');

  const pending = getPendingState(encryptedSecretService);
  assert.ok(pending);
  assert.equal(pending.value.redirectTo, '/app/activity/blocklist');
  assert.equal(pending.value.pinId, '123');
});

test('completeSignIn resolves a linked user and delegates session issuance', async (t) => {
  const encryptedSecretService = createEncryptedSecretServiceDouble();
  const linkedUser = {
    id: 'user-1',
    is_disabled: false,
    auth_subject: 'plex-uuid-1',
  };
  const issueLinkedLogin = t.mock.fn(async ({ userId }) => ({
    user: { id: userId, username: 'plex-user' },
    issuedSession: { refreshToken: 'refresh-1', csrfToken: 'csrf-1' },
  }));

  const service = createPlexDirectSignInService({
    encryptedSecretService,
    findLinkedUserFn: async () => linkedUser,
    issueLinkedLogin,
    loadSettingsFn: async () => ({ system: { baseUrl: 'https://harmoniarr.example.test' } }),
    plexHttpClient: {
      async createPin() {
        return { code: 'PINCODE', id: 123 };
      },
      async fetchCurrentUser() {
        return {
          email: 'plex@example.com',
          id: 'plex-id-1',
          restricted: false,
          title: 'Plex User',
          username: 'plexuser',
          uuid: 'plex-uuid-1',
        };
      },
      async readPin() {
        return { authToken: 'plex-token' };
      },
    },
    recordAuditEventFn: async () => {},
  });

  await service.startSignIn({ redirectTo: '/app/activity/blocklist', requestMetadata: {} });
  const pending = getPendingState(encryptedSecretService);

  const result = await service.completeSignIn({
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
    state: pending.name.replace('auth.plex.sign_in.pending.', ''),
  });

  assert.equal(issueLinkedLogin.mock.callCount(), 1);
  assert.deepEqual(issueLinkedLogin.mock.calls[0].arguments[0], {
    provider: 'plex',
    subject: 'plex-uuid-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
    userId: 'user-1',
  });
  assert.equal(result.redirectTo, '/app/activity/blocklist');
  assert.equal(result.user.username, 'plex-user');
  assert.equal(getPendingStateName(encryptedSecretService), null);
});

test('completeSignIn rejects restricted Plex accounts', async () => {
  const encryptedSecretService = createEncryptedSecretServiceDouble();
  const service = createPlexDirectSignInService({
    encryptedSecretService,
    loadSettingsFn: async () => ({ system: { baseUrl: 'https://harmoniarr.example.test' } }),
    plexHttpClient: {
      async createPin() {
        return { code: 'PINCODE', id: 123 };
      },
      async fetchCurrentUser() {
        return {
          id: 'plex-id-1',
          restricted: true,
          username: 'managed-user',
          uuid: 'plex-uuid-1',
        };
      },
      async readPin() {
        return { authToken: 'plex-token' };
      },
    },
    recordAuditEventFn: async () => {},
  });

  await service.startSignIn({ requestMetadata: {} });
  const pending = getPendingState(encryptedSecretService);

  await assert.rejects(
    () => service.completeSignIn({
      requestMetadata: {},
      state: pending.name.replace('auth.plex.sign_in.pending.', ''),
    }),
    (error) => error?.status === 403 && error?.code === 'plex_sign_in_restricted_account',
  );
  assert.equal(getPendingStateName(encryptedSecretService), null);
});

test('completeSignIn rejects Plex accounts that are not linked to a local user', async () => {
  const encryptedSecretService = createEncryptedSecretServiceDouble();
  const service = createPlexDirectSignInService({
    encryptedSecretService,
    findLinkedUserFn: async () => null,
    loadSettingsFn: async () => ({ system: { baseUrl: 'https://harmoniarr.example.test' } }),
    plexHttpClient: {
      async createPin() {
        return { code: 'PINCODE', id: 123 };
      },
      async fetchCurrentUser() {
        return {
          id: 'plex-id-1',
          restricted: false,
          username: 'plexuser',
          uuid: 'plex-uuid-1',
        };
      },
      async readPin() {
        return { authToken: 'plex-token' };
      },
    },
    recordAuditEventFn: async () => {},
  });

  await service.startSignIn({ requestMetadata: {} });
  const pending = getPendingState(encryptedSecretService);

  await assert.rejects(
    () => service.completeSignIn({
      requestMetadata: {},
      state: pending.name.replace('auth.plex.sign_in.pending.', ''),
    }),
    (error) => error?.status === 403 && error?.code === 'plex_sign_in_not_linked',
  );
  assert.equal(getPendingStateName(encryptedSecretService), null);
});

test('startSignIn falls back to default redirect when redirect target is unsafe', async () => {
  const encryptedSecretService = createEncryptedSecretServiceDouble();
  const service = createPlexDirectSignInService({
    encryptedSecretService,
    loadSettingsFn: async () => ({ system: { baseUrl: 'https://harmoniarr.example.test' } }),
    plexHttpClient: {
      async createPin() {
        return { code: 'PINCODE', id: 123 };
      },
    },
    recordAuditEventFn: async () => {},
  });

  const result = await service.startSignIn({ redirectTo: 'https://evil.example', requestMetadata: {} });
  assert.equal(result.redirectTo, '/app');
});
