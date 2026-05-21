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
import { createApiError } from '../../src/server/auth.js';
import { normalizeUserPreferences, VALID_PREFERRED_FORMATS, VALID_MINIMUM_QUALITIES } from '../../src/server/app-user-service.js';
import { NOTIFICATION_CATEGORY_KEYS, buildDefaultNotificationPreferences } from '../../src/server/notification/notification-preference-constants.js';
import { registerAppUserRoutes } from '../../src/server/routes/app-user-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_SESSION = { appUserId: 'user-pref-1', csrfToken: 'csrf-pref' };

const DEFAULT_PREFERENCES = { preferredFormat: 'any', minimumQuality: 'any', notificationPreferences: buildDefaultNotificationPreferences() };

function createPreferencesRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerAppUserRoutes(app, {
      // Provide no-op stubs for all required deps so the router registers cleanly.
      createAppUser: async () => {},
      claimManagedLibraryRoot: async () => {},
      getUserPreferences: async () => DEFAULT_PREFERENCES,
      listAppUsers: async () => [],
      resetAppUserPassword: async () => {},
      provisionManagedLibraryRoot: async () => {},
      requireAdminSession: async () => TEST_SESSION,
      requireCsrf: () => {},
      requireFreshAdminSession: async () => TEST_SESSION,
      requireFreshSession: async () => TEST_SESSION,
      roleOptions: ['operator', 'requester'],
      updateAppUser: async () => {},
      updateUserPreferences: async ({ preferences }) => ({
        preferredFormat: preferences?.preferredFormat ?? 'any',
        minimumQuality: preferences?.minimumQuality ?? 'any',
        notificationPreferences: preferences?.notificationPreferences ?? buildDefaultNotificationPreferences(),
      }),
      ...overrides,
    });
  });
}

// ── normalizeUserPreferences ──────────────────────────────────────────────────

test('normalizeUserPreferences: returns all-any defaults for empty object', () => {
  const result = normalizeUserPreferences({});
  assert.equal(result.preferredFormat, 'any');
  assert.equal(result.minimumQuality, 'any');
  assert.deepEqual(result.notificationPreferences, buildDefaultNotificationPreferences());
});

test('normalizeUserPreferences: returns all-any defaults for null', () => {
  const result = normalizeUserPreferences(null);
  assert.equal(result.preferredFormat, 'any');
  assert.equal(result.minimumQuality, 'any');
  assert.deepEqual(result.notificationPreferences, buildDefaultNotificationPreferences());
});

test('normalizeUserPreferences: preserves valid preferredFormat values', () => {
  for (const format of VALID_PREFERRED_FORMATS) {
    const result = normalizeUserPreferences({ preferredFormat: format });
    assert.equal(result.preferredFormat, format, `expected ${format} to be preserved`);
  }
});

test('normalizeUserPreferences: preserves valid minimumQuality values', () => {
  for (const quality of VALID_MINIMUM_QUALITIES) {
    const result = normalizeUserPreferences({ minimumQuality: quality });
    assert.equal(result.minimumQuality, quality, `expected ${quality} to be preserved`);
  }
});

test('normalizeUserPreferences: falls back to any for unknown preferredFormat', () => {
  assert.equal(normalizeUserPreferences({ preferredFormat: 'ogg' }).preferredFormat, 'any');
});

test('normalizeUserPreferences: falls back to any for unknown minimumQuality', () => {
  assert.equal(normalizeUserPreferences({ minimumQuality: 'ultra' }).minimumQuality, 'any');
});

test('normalizeUserPreferences: ignores unrecognised extra keys', () => {
  const result = normalizeUserPreferences({ preferredFormat: 'flac', theme: 'dark', extra: 'value' });
  assert.equal(result.preferredFormat, 'flac');
  assert.equal(result.minimumQuality, 'any');
});

test('normalizeUserPreferences: preserves valid notificationPreferences', () => {
  const prefs = { ...buildDefaultNotificationPreferences(), requestFulfilled: false };
  const result = normalizeUserPreferences({ notificationPreferences: prefs });
  assert.equal(result.notificationPreferences.requestFulfilled, false);
  assert.equal(result.notificationPreferences.downloadCompleted, true);
});

test('normalizeUserPreferences: fills defaults for missing notification category keys', () => {
  const result = normalizeUserPreferences({ notificationPreferences: { requestFulfilled: false } });
  assert.equal(result.notificationPreferences.requestFulfilled, false);
  for (const key of NOTIFICATION_CATEGORY_KEYS) {
    if (key !== 'requestFulfilled') {
      assert.equal(result.notificationPreferences[key], true, `${key} should default to true`);
    }
  }
});

test('normalizeUserPreferences: ignores non-boolean notification values', () => {
  const result = normalizeUserPreferences({ notificationPreferences: { requestFulfilled: 'yes' } });
  assert.equal(result.notificationPreferences.requestFulfilled, true);
});

test('normalizeUserPreferences: ignores non-object notificationPreferences', () => {
  const result = normalizeUserPreferences({ notificationPreferences: 'all' });
  assert.deepEqual(result.notificationPreferences, buildDefaultNotificationPreferences());
});

// ── GET /api/v1/users/me/preferences ─────────────────────────────────────────

test('GET /users/me/preferences: returns preferences for the authenticated user', async (t) => {
  const fullPrefs = { preferredFormat: 'flac', minimumQuality: 'lossless', notificationPreferences: buildDefaultNotificationPreferences() };
  const getUserPreferences = t.mock.fn(async () => fullPrefs);
  const app = createPreferencesRouteTestApp({ getUserPreferences });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/me/preferences`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.preferences.preferredFormat, 'flac');
    assert.equal(payload.preferences.minimumQuality, 'lossless');
    assert.deepEqual(payload.preferences.notificationPreferences, buildDefaultNotificationPreferences());
  });
});

test('GET /users/me/preferences: calls getUserPreferences with the session user id', async (t) => {
  const getUserPreferences = t.mock.fn(async () => DEFAULT_PREFERENCES);
  const app = createPreferencesRouteTestApp({ getUserPreferences });

  await withServer(app, async (baseUrl) => {
    await fetch(`${baseUrl}/api/v1/users/me/preferences`);

    assert.equal(getUserPreferences.mock.callCount(), 1);
    assert.equal(getUserPreferences.mock.calls[0].arguments[0].userId, TEST_SESSION.appUserId);
  });
});

test('GET /users/me/preferences: preserves auth failures from the injected fresh-session guard', async () => {
  const requireFreshSession = async () => { throw createApiError(401, 'auth_required', 'Not authenticated'); };
  const app = createPreferencesRouteTestApp({ requireFreshSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/me/preferences`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error?.code, 'auth_required');
  });
});

// ── PATCH /api/v1/users/me/preferences ───────────────────────────────────────

test('PATCH /users/me/preferences: returns updated preferences on valid input', async (t) => {
  const updatedPrefs = { preferredFormat: 'mp3_320', minimumQuality: 'high', notificationPreferences: buildDefaultNotificationPreferences() };
  const updateUserPreferences = t.mock.fn(async () => updatedPrefs);
  const app = createPreferencesRouteTestApp({ updateUserPreferences });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/me/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredFormat: 'mp3_320', minimumQuality: 'high' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.preferences.preferredFormat, 'mp3_320');
    assert.equal(payload.preferences.minimumQuality, 'high');
  });
});

test('PATCH /users/me/preferences: calls updateUserPreferences with session user id', async (t) => {
  const updateUserPreferences = t.mock.fn(async () => DEFAULT_PREFERENCES);
  const app = createPreferencesRouteTestApp({ updateUserPreferences });

  await withServer(app, async (baseUrl) => {
    await fetch(`${baseUrl}/api/v1/users/me/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredFormat: 'flac' }),
    });

    assert.equal(updateUserPreferences.mock.callCount(), 1);
    const callArgs = updateUserPreferences.mock.calls[0].arguments[0];
    assert.equal(callArgs.userId, TEST_SESSION.appUserId);
    assert.equal(callArgs.actorUserId, TEST_SESSION.appUserId);
  });
});

test('PATCH /users/me/preferences: passes the request body as the preferences patch', async (t) => {
  const updateUserPreferences = t.mock.fn(async () => DEFAULT_PREFERENCES);
  const app = createPreferencesRouteTestApp({ updateUserPreferences });

  await withServer(app, async (baseUrl) => {
    const patch = { preferredFormat: 'mp3_v0', minimumQuality: 'any' };
    await fetch(`${baseUrl}/api/v1/users/me/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });

    const callArgs = updateUserPreferences.mock.calls[0].arguments[0];
    assert.deepEqual(callArgs.preferences, patch);
  });
});

test('PATCH /users/me/preferences: preserves CSRF failures from the injected guard', async () => {
  const requireCsrf = () => { throw createApiError(403, 'csrf_invalid', 'CSRF token mismatch'); };
  const app = createPreferencesRouteTestApp({ requireCsrf });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/me/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredFormat: 'flac' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.error?.code, 'csrf_invalid');
  });
});

test('PATCH /users/me/preferences: preserves service validation errors', async () => {
  const updateUserPreferences = async () => {
    throw createApiError(400, 'validation_error', 'preferredFormat must be one of: any, flac, mp3_320, mp3_v0');
  };
  const app = createPreferencesRouteTestApp({ updateUserPreferences });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/me/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredFormat: 'ogg' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error?.code, 'validation_error');
  });
});

test('PATCH /users/me/preferences: preserves auth failures from the injected fresh-session guard', async () => {
  const requireFreshSession = async () => { throw createApiError(401, 'auth_required', 'Not authenticated'); };
  const app = createPreferencesRouteTestApp({ requireFreshSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/me/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredFormat: 'flac' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error?.code, 'auth_required');
  });
});

// ── PATCH /api/v1/users/me/preferences with notificationPreferences ──────────

test('PATCH /users/me/preferences: accepts notificationPreferences with valid booleans', async (t) => {
  const notifPrefs = { ...buildDefaultNotificationPreferences(), requestFulfilled: false };
  const updatedPrefs = { preferredFormat: 'any', minimumQuality: 'any', notificationPreferences: notifPrefs };
  const updateUserPreferences = t.mock.fn(async () => updatedPrefs);
  const app = createPreferencesRouteTestApp({ updateUserPreferences });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/me/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationPreferences: { requestFulfilled: false } }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.preferences.notificationPreferences.requestFulfilled, false);
  });
});

test('PATCH /users/me/preferences: rejects non-object notificationPreferences', async (t) => {
  const updateUserPreferences = async () => {
    throw createApiError(400, 'validation_error', 'notificationPreferences must be an object');
  };
  const app = createPreferencesRouteTestApp({ updateUserPreferences });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/me/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationPreferences: 'all' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error?.code, 'validation_error');
  });
});

test('PATCH /users/me/preferences: rejects unknown notification category keys', async (t) => {
  const updateUserPreferences = async () => {
    throw createApiError(400, 'validation_error', 'Unknown notification categories: fakeCategory');
  };
  const app = createPreferencesRouteTestApp({ updateUserPreferences });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/me/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationPreferences: { fakeCategory: true } }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error?.code, 'validation_error');
    assert.ok(payload.error?.message?.includes('Unknown notification'));
  });
});

test('PATCH /users/me/preferences: rejects non-boolean notification category value', async (t) => {
  const updateUserPreferences = async () => {
    throw createApiError(400, 'validation_error', 'notificationPreferences.requestFulfilled must be a boolean');
  };
  const app = createPreferencesRouteTestApp({ updateUserPreferences });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/me/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationPreferences: { requestFulfilled: 'yes' } }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error?.code, 'validation_error');
  });
});
