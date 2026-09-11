/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approveExternalRequestRelease, fetchExternalRequestReview,
  excludeExternalRequestCollectionItem, finalizeExternalRequestCollection,
  recoverExternalRequestPreparation, searchExternalRequestReleases,
  startExternalRequestCollection,
} from '../../src/client/lib/external-request-review-api.js';

function setup(t) {
  const previousDocument = globalThis.document;
  t.after(() => { globalThis.document = previousDocument; });
  globalThis.document = { cookie: 'harmoniarr_csrf=test-token' };
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  });
  return calls;
}

test('external review reads encode the request path and carry the abort signal', async (t) => {
  const calls = setup(t);
  const controller = new AbortController();
  await fetchExternalRequestReview({ mediaRequestId: 'request/one', signal: controller.signal });
  assert.equal(calls[0].url, '/api/v1/library/media-requests/request%2Fone/external-review');
  assert.equal(calls[0].options.signal, controller.signal);
  assert.equal(calls[0].options.method, 'GET');
});

test('local release search preserves literal artist and title query values', async (t) => {
  const calls = setup(t);
  await searchExternalRequestReleases({ mediaRequestId: 'r1', artistName: 'AC/DC & friends', releaseTitle: 'Love + Live?' });
  const url = new URL(calls[0].url, 'http://localhost');
  assert.equal(url.pathname, '/api/v1/library/media-requests/r1/external-review/releases');
  assert.equal(url.searchParams.get('artistName'), 'AC/DC & friends');
  assert.equal(url.searchParams.get('releaseTitle'), 'Love + Live?');
});

test('approval sends only selected persisted identifiers with CSRF protection', async (t) => {
  const calls = setup(t);
  await approveExternalRequestRelease({ mediaRequestId: 'r1', providerIngestRequestId: 'p1', metadataReleaseId: 'm1', requestedForUserId: 'forged' });
  assert.equal(calls[0].url, '/api/v1/library/media-requests/r1/external-review/approve');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.get('X-CSRF-Token'), 'test-token');
  assert.deepEqual(JSON.parse(calls[0].options.body), { providerIngestRequestId: 'p1', metadataReleaseId: 'm1' });
});

test('preparation recovery uses an explicit protected POST with no ownership payload', async (t) => {
  const calls = setup(t);
  await recoverExternalRequestPreparation({ mediaRequestId: 'r1' });
  assert.equal(calls[0].url, '/api/v1/library/media-requests/r1/external-review/recover');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.get('X-CSRF-Token'), 'test-token');
  assert.deepEqual(JSON.parse(calls[0].options.body), {});
});

test('collection review sends bounded cursor reads and revision-checked protected decisions', async (t) => {
  const calls = setup(t);
  await fetchExternalRequestReview({ mediaRequestId: 'r1', cursor: 'page&two', limit: 25 });
  const url = new URL(calls[0].url, 'http://localhost');
  assert.equal(url.searchParams.get('cursor'), 'page&two');
  assert.equal(url.searchParams.get('limit'), '25');
  await approveExternalRequestRelease({ mediaRequestId: 'r1', providerIngestRequestId: 'p1', metadataReleaseId: 'm1', expectedRevision: 7 });
  await excludeExternalRequestCollectionItem({ mediaRequestId: 'r1', collectionItemId: 'item/1', reason: 'Unavailable', expectedRevision: 8 });
  await finalizeExternalRequestCollection({ mediaRequestId: 'r1', expectedRevision: 9 });
  await startExternalRequestCollection({ mediaRequestId: 'r1', restart: true });
  assert.deepEqual(calls.slice(1).map(({ options }) => JSON.parse(options.body)), [
    { providerIngestRequestId: 'p1', metadataReleaseId: 'm1', expectedRevision: 7 },
    { reason: 'Unavailable', expectedRevision: 8 }, { expectedRevision: 9 }, { restart: true },
  ]);
  assert.equal(calls[2].url, '/api/v1/library/media-requests/r1/external-review/collection/items/item%2F1/exclude');
  assert.equal(calls[3].url, '/api/v1/library/media-requests/r1/external-review/collection/finalize');
  assert.equal(calls[4].url, '/api/v1/library/media-requests/r1/external-review/collection/start');
  for (const { options } of calls.slice(1)) {
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.get('X-CSRF-Token'), 'test-token');
  }
});
