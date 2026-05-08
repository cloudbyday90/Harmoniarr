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
import { fetchVapidPublicKey, subscribeToPush, unsubscribeFromPush } from '../../src/client/lib/push-api.js';

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

// ── fetchVapidPublicKey ───────────────────────────────────────────────────────

test('push-api fetchVapidPublicKey calls GET /api/v1/push/vapid-public-key', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () =>
    createJsonResponse({ payload: { ok: true, vapidPublicKey: 'BTest123' } }),
  );

  const result = await fetchVapidPublicKey();

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
  assert.ok(url.includes('/api/v1/push/vapid-public-key'));
  assert.equal(opts.method, 'GET');
  assert.equal(result.vapidPublicKey, 'BTest123');
});

// ── subscribeToPush ───────────────────────────────────────────────────────────

test('push-api subscribeToPush calls POST /api/v1/push/subscribe with correct body', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=token-abc' };
  globalThis.fetch = t.mock.fn(async () =>
    createJsonResponse({ payload: { ok: true, id: 'sub-1' }, status: 201 }),
  );

  const result = await subscribeToPush({
    endpoint: 'https://push.example.com/sub/1',
    keys: { p256dh: 'pkey', auth: 'akey' },
    userAgent: 'TestBrowser/1.0',
  });

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
  assert.ok(url.includes('/api/v1/push/subscribe'));
  assert.equal(opts.method, 'POST');

  const body = JSON.parse(opts.body);
  assert.equal(body.endpoint, 'https://push.example.com/sub/1');
  assert.equal(body.keys.p256dh, 'pkey');
  assert.equal(body.keys.auth, 'akey');
  assert.equal(body.userAgent, 'TestBrowser/1.0');
  assert.equal(result.id, 'sub-1');
});

test('push-api subscribeToPush includes CSRF token header', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=my-csrf' };
  globalThis.fetch = t.mock.fn(async () =>
    createJsonResponse({ payload: { ok: true, id: 'sub-2' }, status: 201 }),
  );

  await subscribeToPush({
    endpoint: 'https://push.example.com/sub/2',
    keys: { p256dh: 'pk', auth: 'ak' },
  });

  const [, opts] = globalThis.fetch.mock.calls[0].arguments;
  const headers = Object.fromEntries(opts.headers.entries());
  assert.equal(headers['x-csrf-token'], 'my-csrf');
});

test('push-api subscribeToPush uses null userAgent when not provided', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () =>
    createJsonResponse({ payload: { ok: true, id: 'sub-3' }, status: 201 }),
  );

  await subscribeToPush({
    endpoint: 'https://push.example.com/sub/3',
    keys: { p256dh: 'pk', auth: 'ak' },
  });

  const [, opts] = globalThis.fetch.mock.calls[0].arguments;
  const body = JSON.parse(opts.body);
  assert.equal(body.userAgent, null);
});

// ── unsubscribeFromPush ───────────────────────────────────────────────────────

test('push-api unsubscribeFromPush calls DELETE /api/v1/push/subscribe with endpoint', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=del-csrf' };
  globalThis.fetch = t.mock.fn(async () =>
    createJsonResponse({ payload: { ok: true } }),
  );

  const result = await unsubscribeFromPush({ endpoint: 'https://push.example.com/sub/4' });

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
  assert.ok(url.includes('/api/v1/push/subscribe'));
  assert.equal(opts.method, 'DELETE');

  const body = JSON.parse(opts.body);
  assert.equal(body.endpoint, 'https://push.example.com/sub/4');
  assert.equal(result.ok, true);
});

test('push-api unsubscribeFromPush includes CSRF token header', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=del-csrf-2' };
  globalThis.fetch = t.mock.fn(async () =>
    createJsonResponse({ payload: { ok: true } }),
  );

  await unsubscribeFromPush({ endpoint: 'https://push.example.com/sub/5' });

  const [, opts] = globalThis.fetch.mock.calls[0].arguments;
  const headers = Object.fromEntries(opts.headers.entries());
  assert.equal(headers['x-csrf-token'], 'del-csrf-2');
});
