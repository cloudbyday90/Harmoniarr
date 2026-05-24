import assert from 'node:assert/strict';
import test from 'node:test';
import {
  browseFsDirectory,
  fetchLibraryScanSummary,
  fetchOnboardingSummary,
  fetchSystemActivityFeed,
  fetchSystemOperatorNotifications,
  fetchSystemOverview,
} from '../../src/client/lib/system-api.js';

function createJsonResponse({ ok = true, payload = { ok: true }, status = 200 } = {}) {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

test('system-api routes summary and overview GETs through the shared api client', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchLibraryScanSummary();
  await fetchOnboardingSummary();
  await fetchSystemOverview();

  assert.equal(globalThis.fetch.mock.callCount(), 3);
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/system/library-scan-summary');
  assert.equal(globalThis.fetch.mock.calls[1].arguments[0], '/api/v1/system/onboarding');
  assert.equal(globalThis.fetch.mock.calls[2].arguments[0], '/api/v1/system/overview');
});

test('system-api fetchSystemActivityFeed sends before and limit query params', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchSystemActivityFeed({ before: 'cursor-abc', limit: 25 });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('before=cursor-abc'));
  assert.ok(url.includes('limit=25'));
});

test('system-api fetchSystemActivityFeed omits params when none provided', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchSystemActivityFeed();

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/system/activity-feed');
});

test('system-api fetchSystemOperatorNotifications sends limit query param', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchSystemOperatorNotifications({ limit: 10 });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('limit=10'));
});

test('system-api fetchSystemOperatorNotifications omits params when none provided', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchSystemOperatorNotifications();

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/system/operator-notifications');
});

test('system-api browseFsDirectory sends path query param', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await browseFsDirectory({ path: '/music/albums' });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('path='));
});

test('system-api browseFsDirectory omits params when none provided', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await browseFsDirectory();

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/system/fs/browse');
});
