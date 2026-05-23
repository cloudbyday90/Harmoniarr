import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMediaRequest,
  fetchLibraryDiscoverySummary,
  fetchLibraryOrganizePreview,
  fetchMediaRequestDetail,
  fetchMediaRequestEvents,
  fetchMediaRequests,
  fetchMediaRequestReassignmentHistory,
  fetchMediaRequestSummary,
  reassignMediaRequest,
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

test('library-api reassignMediaRequest sends POST with CSRF', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-reassign' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await reassignMediaRequest({
    mediaRequestId: 'req-1',
    newRequestedForUserId: 'u-2',
    reason: 'User left',
  });

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/library/media-requests/req-1/reassign');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'POST');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].headers.get('X-CSRF-Token'), 'csrf-reassign');

  const body = JSON.parse(globalThis.fetch.mock.calls[0].arguments[1].body);
  assert.equal(body.newRequestedForUserId, 'u-2');
  assert.equal(body.reason, 'User left');
});

test('library-api fetchMediaRequestReassignmentHistory sends GET', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMediaRequestReassignmentHistory({ mediaRequestId: 'req-1' });

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/library/media-requests/req-1/reassignment-history');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'GET');
});

test('library-api reassignMediaRequest encodes mediaRequestId in URL', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await reassignMediaRequest({ mediaRequestId: 'req/slash', newRequestedForUserId: 'u-1', reason: null });

  assert.ok(globalThis.fetch.mock.calls[0].arguments[0].includes('req%2Fslash'));
});

test('library-api fetchMediaRequestDetail sends GET with encoded id', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMediaRequestDetail({ mediaRequestId: 'req-1' });

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/library/media-requests/req-1');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'GET');
});

test('library-api fetchMediaRequestDetail encodes special characters', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMediaRequestDetail({ mediaRequestId: 'req/slash' });

  assert.ok(globalThis.fetch.mock.calls[0].arguments[0].includes('req%2Fslash'));
});

test('library-api fetchMediaRequestEvents sends GET without params', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMediaRequestEvents({ mediaRequestId: 'req-1' });

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/library/media-requests/req-1/events');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'GET');
});

test('library-api fetchMediaRequestEvents sends cursor and limit as query params', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMediaRequestEvents({ mediaRequestId: 'req-1', cursor: 'abc123', limit: 25 });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('cursor=abc123'));
  assert.ok(url.includes('limit=25'));
});

test('library-api fetchMediaRequestEvents encodes mediaRequestId', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMediaRequestEvents({ mediaRequestId: 'req/slash' });

  assert.ok(globalThis.fetch.mock.calls[0].arguments[0].includes('req%2Fslash'));
});
