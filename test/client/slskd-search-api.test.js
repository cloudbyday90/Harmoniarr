import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchSlskdDownloads,
  fetchSlskdSearchResponses,
  fetchSlskdSearchState,
  fetchSlskdStatus,
  startSlskdSearch,
} from '../../src/client/lib/slskd-search-api.js';

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

test('slskd-search-api fetchSlskdStatus returns unwrapped status', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: { status: { connected: true } } }));

  const result = await fetchSlskdStatus();
  assert.deepEqual(result, { connected: true });
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/slskd/status');
});

test('slskd-search-api fetchSlskdStatus returns null when payload has no status', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: {} }));

  const result = await fetchSlskdStatus();
  assert.equal(result, null);
});

test('slskd-search-api startSlskdSearch sends POST with body and returns search', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-slskd' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: { search: { id: 'search-1' } } }));

  const result = await startSlskdSearch({ query: 'daft punk', fileLimit: 100 });
  assert.deepEqual(result, { id: 'search-1' });
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/slskd/searches');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'POST');

  const body = JSON.parse(globalThis.fetch.mock.calls[0].arguments[1].body);
  assert.equal(body.query, 'daft punk');
  assert.equal(body.fileLimit, 100);
});

test('slskd-search-api startSlskdSearch returns null when payload has no search', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-slskd' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: {} }));

  const result = await startSlskdSearch({ query: 'test' });
  assert.equal(result, null);
});

test('slskd-search-api fetchSlskdSearchState sends GET with searchId', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: { search: { id: 's-1' } } }));

  const result = await fetchSlskdSearchState({ searchId: 's-1' });
  assert.deepEqual(result, { id: 's-1' });
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/slskd/searches/s-1');
});

test('slskd-search-api fetchSlskdSearchState includes includeResponses param', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: { search: {} } }));

  await fetchSlskdSearchState({ searchId: 's-1', includeResponses: true });
  assert.ok(globalThis.fetch.mock.calls[0].arguments[0].includes('includeResponses=true'));
});

test('slskd-search-api fetchSlskdSearchState encodes searchId', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: { search: {} } }));

  await fetchSlskdSearchState({ searchId: 's/slash' });
  assert.ok(globalThis.fetch.mock.calls[0].arguments[0].includes('s%2Fslash'));
});

test('slskd-search-api fetchSlskdSearchResponses returns responses array', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: { responses: [{ id: 'r-1' }] } }));

  const result = await fetchSlskdSearchResponses({ searchId: 's-1' });
  assert.deepEqual(result, [{ id: 'r-1' }]);
});

test('slskd-search-api fetchSlskdSearchResponses returns empty array when no responses', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: {} }));

  const result = await fetchSlskdSearchResponses({ searchId: 's-1' });
  assert.deepEqual(result, []);
});

test('slskd-search-api fetchSlskdDownloads returns downloads array', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: { downloads: [{ id: 'd-1' }] } }));

  const result = await fetchSlskdDownloads();
  assert.deepEqual(result, [{ id: 'd-1' }]);
});

test('slskd-search-api fetchSlskdDownloads with includeRemoved sends query param', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: { downloads: [] } }));

  await fetchSlskdDownloads({ includeRemoved: true });
  assert.ok(globalThis.fetch.mock.calls[0].arguments[0].includes('includeRemoved=true'));
});

test('slskd-search-api fetchSlskdDownloads without includeRemoved omits query param', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: { downloads: [] } }));

  await fetchSlskdDownloads();
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/slskd/downloads');
});
