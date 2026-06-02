import assert from 'node:assert/strict';
import test from 'node:test';
import {
  batchResolveArtwork,
  fetchArtworkQuotaHistory,
  patchArtworkDominantColor,
  resolveArtwork,
} from '../../src/client/lib/artwork-api.js';

function createJsonResponse(payload = {}) {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    ok: true,
    status: 200,
    async json() {
      return payload;
    },
  };
}

test('resolveArtwork builds URL without refresh when refresh is omitted', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ url: null }));

  await resolveArtwork({ ownerType: 'musicbrainz_artist', ownerId: 'mbid-1', artworkRole: 'artist_thumbnail' });

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(!url.includes('refresh'), `URL should not contain refresh: ${url}`);
});

test('resolveArtwork builds URL with refresh=true when refresh is true', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ url: null }));

  await resolveArtwork({ ownerType: 'musicbrainz_artist', ownerId: 'mbid-1', artworkRole: 'artist_thumbnail', refresh: true });

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('refresh=true'), `URL should contain refresh=true: ${url}`);
});

test('resolveArtwork omits refresh from URL when refresh is false', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ url: null }));

  await resolveArtwork({ ownerType: 'musicbrainz_artist', ownerId: 'mbid-1', artworkRole: 'artist_thumbnail', refresh: false });

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(!url.includes('refresh'), `URL should not contain refresh: ${url}`);
});

test('batchResolveArtwork sends requests with refresh in body', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ resolved: {} }));

  await batchResolveArtwork([
    { ownerType: 'musicbrainz_release', ownerId: 'mbid-1', refresh: true },
    { ownerType: 'musicbrainz_release', ownerId: 'mbid-2' },
  ]);

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const [, opts] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(opts.method, 'POST');
  const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body;
  assert.equal(body.requests[0].refresh, true);
  assert.equal(body.requests[1].refresh, undefined);
});

test('patchArtworkDominantColor sends a JSON object body with CSRF credentials', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-token' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ ok: true, updated: true }));

  await patchArtworkDominantColor('asset/with unsafe chars', { hue: 180, chroma: 0.2, lightness: 0.5 });

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const [url, opts] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(url, '/api/v1/artwork/assets/asset%2Fwith%20unsafe%20chars/dominant-color');
  assert.equal(opts.method, 'PATCH');
  assert.equal(opts.credentials, 'same-origin');
  assert.equal(opts.headers.get('X-CSRF-Token'), 'csrf-token');
  assert.deepEqual(JSON.parse(opts.body), { hue: 180, chroma: 0.2, lightness: 0.5 });
});

test('fetchArtworkQuotaHistory builds URL with days parameter', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ days: 7, history: {}, limit: 100 }));

  await fetchArtworkQuotaHistory({ days: 7 });

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('days=7'), `URL should contain days=7: ${url}`);
});

test('fetchArtworkQuotaHistory defaults to 30 days', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ days: 30, history: {}, limit: 100 }));

  await fetchArtworkQuotaHistory();

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('days=30'), `URL should contain days=30: ${url}`);
});
