import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearPlexLink,
  clearSpotifyOAuth,
  clearYouTubeOAuth,
  fetchSettings,
  startPlexLink,
  startSpotifyOAuth,
  startYouTubeOAuth,
  updateSettings,
} from '../../src/client/lib/settings-api.js';

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

test('settings-api fetchSettings sends GET to settings endpoint', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchSettings();

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/settings');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'GET');
});

test('settings-api updateSettings sends PUT with CSRF and body', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-settings' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await updateSettings({ downloadsPath: '/music' });

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/settings');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'PUT');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].headers.get('X-CSRF-Token'), 'csrf-settings');

  const body = JSON.parse(globalThis.fetch.mock.calls[0].arguments[1].body);
  assert.equal(body.downloadsPath, '/music');
});

test('settings-api OAuth and Plex link mutations send POST with CSRF', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-oauth' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await startSpotifyOAuth();
  await startPlexLink();
  await clearPlexLink();
  await clearSpotifyOAuth();
  await startYouTubeOAuth();
  await clearYouTubeOAuth();

  assert.equal(globalThis.fetch.mock.callCount(), 6);

  const urls = Array.from({ length: 6 }, (_, i) => globalThis.fetch.mock.calls[i].arguments[0]);
  assert.equal(urls[0], '/api/v1/providers/spotify/oauth/start');
  assert.equal(urls[1], '/api/v1/providers/plex/link/start');
  assert.equal(urls[2], '/api/v1/providers/plex/link/clear');
  assert.equal(urls[3], '/api/v1/providers/spotify/oauth/clear');
  assert.equal(urls[4], '/api/v1/providers/youtube/oauth/start');
  assert.equal(urls[5], '/api/v1/providers/youtube/oauth/clear');

  for (let i = 0; i < 6; i++) {
    assert.equal(globalThis.fetch.mock.calls[i].arguments[1].method, 'POST');
    assert.equal(globalThis.fetch.mock.calls[i].arguments[1].headers.get('X-CSRF-Token'), 'csrf-oauth');
  }
});
