import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMediaRequest,
  fetchLibraryDiscoverySummary,
  fetchLibraryOrganizePreview,
  fetchMediaRequests,
  fetchMediaRequestSummary,
} from '../../src/client/lib/library-api.js';

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

test('library-api routes discovery and media request calls through the shared api client contract', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-library' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchLibraryDiscoverySummary();
  await fetchMediaRequestSummary({ scope: 'all' });
  await fetchMediaRequests({ scope: 'mine' });
  await fetchLibraryOrganizePreview();
  await createMediaRequest({ artistName: 'Daft Punk', releaseTitle: 'Discovery', requestKind: 'release' });

  assert.equal(globalThis.fetch.mock.callCount(), 5);
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/library/discovery-summary');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'GET');
  assert.equal(globalThis.fetch.mock.calls[1].arguments[0], '/api/v1/library/media-request-summary?scope=all');
  assert.equal(globalThis.fetch.mock.calls[1].arguments[1].method, 'GET');
  assert.equal(globalThis.fetch.mock.calls[2].arguments[0], '/api/v1/library/media-requests?scope=mine');
  assert.equal(globalThis.fetch.mock.calls[2].arguments[1].method, 'GET');
  assert.equal(globalThis.fetch.mock.calls[3].arguments[0], '/api/v1/library/organize-preview');
  assert.equal(globalThis.fetch.mock.calls[3].arguments[1].method, 'GET');
  assert.equal(globalThis.fetch.mock.calls[4].arguments[0], '/api/v1/library/media-requests');
  assert.equal(globalThis.fetch.mock.calls[4].arguments[1].method, 'POST');
  assert.equal(globalThis.fetch.mock.calls[4].arguments[1].headers.get('X-CSRF-Token'), 'csrf-library');
});
