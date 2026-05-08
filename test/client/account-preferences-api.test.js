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
import { fetchMyPreferences, updateMyPreferences } from '../../src/client/lib/account-preferences-api.js';

function createJsonResponse({ payload = { ok: true }, status = 200 } = {}) {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

// ── fetchMyPreferences ────────────────────────────────────────────────────────

test('account-preferences-api fetchMyPreferences calls GET /api/v1/users/me/preferences', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () =>
    createJsonResponse({ payload: { ok: true, preferences: { preferredFormat: 'flac', minimumQuality: 'lossless' } } }),
  );

  const result = await fetchMyPreferences();

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
  assert.ok(url.includes('/api/v1/users/me/preferences'));
  assert.equal(opts.method, 'GET');
  assert.deepEqual(result.preferences, { preferredFormat: 'flac', minimumQuality: 'lossless' });
});

test('account-preferences-api fetchMyPreferences forwards signal', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () =>
    createJsonResponse({ payload: { ok: true, preferences: { preferredFormat: 'any', minimumQuality: 'any' } } }),
  );

  const controller = new AbortController();
  await fetchMyPreferences({ signal: controller.signal });

  const [, opts] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(opts.signal, controller.signal);
});

// ── updateMyPreferences ───────────────────────────────────────────────────────

test('account-preferences-api updateMyPreferences calls PATCH /api/v1/users/me/preferences', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-token' };
  globalThis.fetch = t.mock.fn(async () =>
    createJsonResponse({ payload: { ok: true, preferences: { preferredFormat: 'mp3_320', minimumQuality: 'high' } } }),
  );

  const result = await updateMyPreferences({ preferredFormat: 'mp3_320', minimumQuality: 'high' });

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
  assert.ok(url.includes('/api/v1/users/me/preferences'));
  assert.equal(opts.method, 'PATCH');
  assert.deepEqual(result.preferences, { preferredFormat: 'mp3_320', minimumQuality: 'high' });
});

test('account-preferences-api updateMyPreferences includes CSRF token header', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-abc' };
  globalThis.fetch = t.mock.fn(async () =>
    createJsonResponse({ payload: { ok: true, preferences: { preferredFormat: 'any', minimumQuality: 'any' } } }),
  );

  await updateMyPreferences({ preferredFormat: 'any' });

  const [, opts] = globalThis.fetch.mock.calls[0].arguments;
  const headers = Object.fromEntries(opts.headers.entries());
  assert.equal(headers['x-csrf-token'], 'csrf-abc');
});

test('account-preferences-api updateMyPreferences sends only specified keys', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=token' };
  globalThis.fetch = t.mock.fn(async () =>
    createJsonResponse({ payload: { ok: true, preferences: { preferredFormat: 'flac', minimumQuality: 'any' } } }),
  );

  await updateMyPreferences({ preferredFormat: 'flac' });

  const [, opts] = globalThis.fetch.mock.calls[0].arguments;
  const body = JSON.parse(opts.body);
  assert.ok('preferredFormat' in body);
  assert.ok(!('minimumQuality' in body));
});

test('account-preferences-api updateMyPreferences sends both keys when both provided', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=token' };
  globalThis.fetch = t.mock.fn(async () =>
    createJsonResponse({ payload: { ok: true, preferences: { preferredFormat: 'mp3_v0', minimumQuality: 'high' } } }),
  );

  await updateMyPreferences({ preferredFormat: 'mp3_v0', minimumQuality: 'high' });

  const [, opts] = globalThis.fetch.mock.calls[0].arguments;
  const body = JSON.parse(opts.body);
  assert.equal(body.preferredFormat, 'mp3_v0');
  assert.equal(body.minimumQuality, 'high');
});

test('account-preferences-api updateMyPreferences forwards signal', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=token' };
  globalThis.fetch = t.mock.fn(async () =>
    createJsonResponse({ payload: { ok: true, preferences: { preferredFormat: 'any', minimumQuality: 'any' } } }),
  );

  const controller = new AbortController();
  await updateMyPreferences({ preferredFormat: 'any', signal: controller.signal });

  const [, opts] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(opts.signal, controller.signal);
});
