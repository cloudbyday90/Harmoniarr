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
import {
  addMissingMusicDecisionToLibrary,
  allowMissingMusicDecisionFallbackQuality,
  fetchMissingMusicDecisionDetail,
  fetchMissingMusicDecisions,
  fetchMissingMusicDownloaderHandoff,
  findMissingMusicDecisionMatches,
  recheckMissingMusicDecisionLibraryAdd,
  selectMissingMusicDecisionMatch,
  searchMissingMusicDecisionAgain,
  startMissingMusicDecisionDownload,
} from '../../src/client/lib/missing-music-api.js';

function installFetchMock(t, payload = { decisions: [] }) {
  const originalFetch = globalThis.fetch;
  const fetchMock = t.mock.fn(async () => new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
  }));
  globalThis.fetch = fetchMock;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  return fetchMock;
}

test('Add to library sends only an empty canonical decision command with CSRF and stable retry identity', async (t) => {
  const fetchMock = installFetchMock(t, { action: { code: 'add_to_library', outcome: 'queued' } });
  const previousDocument = globalThis.document;
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-token' };
  t.after(() => { globalThis.document = previousDocument; });
  await addMissingMusicDecisionToLibrary({ decisionId: ' wanted/amber ', idempotencyKey: 'add-retry',
    targetUserId: 'other', importCandidateId: 'candidate', path: '/private/download', applySafetyMode: 'manual', minimumBitrateKbps: 128 });
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/v1/missing-music/decisions/wanted%2Famber/add-to-library');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-token');
  assert.equal(options.headers.get('Idempotency-Key'), 'add-retry');
  assert.equal(options.body, '{}');
  assert.throws(() => addMissingMusicDecisionToLibrary({ decisionId: ' ' }), /requires a decisionId/u);
  await addMissingMusicDecisionToLibrary({ decisionId: 'wanted-amber' });
  assert.match(fetchMock.mock.calls[1].arguments[1].headers.get('Idempotency-Key'), /^missing-music-decisions-add-to-library-/u);
});

test('fetchMissingMusicDecisions sends only bounded worklist filter values', async (t) => {
  const fetchMock = installFetchMock(t);

  await fetchMissingMusicDecisions({
    accountStatus: 'disabled',
    limit: 25,
    cursor: 'opaque_cursor',
    offset: 0,
    q: 'Autechre & Amber',
    requestedForUserId: 'user/2',
    scope: 'all',
    state: 'action',
  });

  assert.equal(
    fetchMock.mock.calls[0].arguments[0],
    '/api/v1/missing-music/decisions?accountStatus=disabled&cursor=opaque_cursor&limit=25&offset=0&q=Autechre+%26+Amber&requestedForUserId=user%2F2&scope=all&state=action',
  );
  assert.equal(fetchMock.mock.calls[0].arguments[1].method, 'GET');
});

test('fetchMissingMusicDecisions keeps the UI default focused on action-ready active releases', async (t) => {
  const fetchMock = installFetchMock(t);

  await fetchMissingMusicDecisions();

  assert.equal(
    fetchMock.mock.calls[0].arguments[0],
    '/api/v1/missing-music/decisions?accountStatus=active&limit=50&offset=0&scope=all&state=action',
  );
});

test('worklist reads pass abort signals without putting them in the URL', async (t) => {
  const fetchMock = installFetchMock(t);
  const controller = new AbortController();
  await fetchMissingMusicDecisions({ cursor: 'next_page' }, { signal: controller.signal });
  assert.equal(fetchMock.mock.calls[0].arguments[1].signal, controller.signal);
  assert.equal(new URL(fetchMock.mock.calls[0].arguments[0], 'http://localhost').searchParams.has('signal'), false);
});

test('fetchMissingMusicDecisionDetail encodes only the decision identifier', async (t) => {
  const fetchMock = installFetchMock(t, { decision: {} });

  await fetchMissingMusicDecisionDetail('wanted/amber');

  assert.equal(
    fetchMock.mock.calls[0].arguments[0],
    '/api/v1/missing-music/decisions/wanted%2Famber',
  );
  assert.equal(fetchMock.mock.calls[0].arguments[1].method, 'GET');
});

test('fetchMissingMusicDecisionDetail requires a non-empty decision identifier', () => {
  assert.throws(
    () => fetchMissingMusicDecisionDetail('  '),
    /requires a decisionId/u,
  );
});

test('decision detail reads pass cancellation outside the URL', async (t) => {
  const fetchMock = installFetchMock(t, { decision: {} });
  const controller = new AbortController();
  await fetchMissingMusicDecisionDetail('wanted-amber', { signal: controller.signal });
  assert.equal(fetchMock.mock.calls[0].arguments[1].signal, controller.signal);
});

test('Search again submits only the decision identifier with CSRF and a stable retry key', async (t) => {
  const fetchMock = installFetchMock(t, { action: { searchPreparationStarted: true } });
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-token' };
  t.after(() => { globalThis.document = originalDocument; });
  await searchMissingMusicDecisionAgain({ decisionId: 'wanted/amber', idempotencyKey: 'retry-key' });
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/v1/missing-music/decisions/wanted%2Famber/search-again');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-token');
  assert.equal(options.headers.get('Idempotency-Key'), 'retry-key');
  assert.equal(options.body, '{}');
  assert.throws(() => searchMissingMusicDecisionAgain({ decisionId: ' ' }), /requires a decisionId/u);
});

test('fallback quality submits a target-free decision command with CSRF and durable retry identity', async (t) => {
  const fetchMock = installFetchMock(t, { action: { code: 'allow_fallback_quality' } });
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-token' };
  t.after(() => { globalThis.document = originalDocument; });
  await allowMissingMusicDecisionFallbackQuality({ decisionId: ' wanted/amber ', idempotencyKey: 'quality-retry', targetUserId: 'untrusted-target' });
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/v1/missing-music/decisions/wanted%2Famber/allow-fallback-quality');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-token');
  assert.equal(options.headers.get('Idempotency-Key'), 'quality-retry');
  assert.equal(options.body, '{}');
  assert.throws(() => allowMissingMusicDecisionFallbackQuality({ decisionId: ' ' }), /requires a decisionId/u);
  await allowMissingMusicDecisionFallbackQuality({ decisionId: 'wanted-amber' });
  assert.match(fetchMock.mock.calls[1].arguments[1].headers.get('Idempotency-Key'), /^missing-music-decisions-allow-fallback-quality-/u);
});

test('Find matches sends an initial decision command without target or policy inputs and retains the caller retry key', async (t) => {
  const fetchMock = installFetchMock(t, { action: { code: 'find_matches' } });
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-token' };
  t.after(() => { globalThis.document = originalDocument; });
  await findMissingMusicDecisionMatches({ decisionId: ' wanted/amber ', idempotencyKey: 'find-retry', targetUserId: 'untrusted', reset: true });
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/v1/missing-music/decisions/wanted%2Famber/find-matches');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-token');
  assert.equal(options.headers.get('Idempotency-Key'), 'find-retry');
  assert.equal(options.body, '{}');
  assert.throws(() => findMissingMusicDecisionMatches({ decisionId: ' ' }), /requires a decisionId/u);
  await findMissingMusicDecisionMatches({ decisionId: 'wanted-amber' });
  assert.match(fetchMock.mock.calls[1].arguments[1].headers.get('Idempotency-Key'), /^missing-music-decisions-find-matches-/u);
});

test('fetchMissingMusicDownloaderHandoff sends only the opaque decision identifier', async (t) => {
  const fetchMock = installFetchMock(t, { wantedReleaseId: 'wanted-amber' });

  await fetchMissingMusicDownloaderHandoff('wanted/amber');

  assert.equal(
    fetchMock.mock.calls[0].arguments[0],
    '/api/v1/missing-music/decisions/wanted%2Famber/downloader-handoff',
  );
  assert.equal(fetchMock.mock.calls[0].arguments[1].method, 'GET');
});

test('library-add recheck sends only the canonical decision command with CSRF and stable retry identity', async (t) => {
  const fetchMock = installFetchMock(t, { action: { code: 'recheck_library_add', outcome: 'queued' } });
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-token' };
  t.after(() => { globalThis.document = originalDocument; });
  await recheckMissingMusicDecisionLibraryAdd({ decisionId: ' wanted/amber ', idempotencyKey: 'recheck-retry', targetUserId: 'untrusted', importCandidateId: 'untrusted', path: '/untrusted', applySafetyMode: 'manual' });
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/v1/missing-music/decisions/wanted%2Famber/recheck-library-add');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-token');
  assert.equal(options.headers.get('Idempotency-Key'), 'recheck-retry');
  assert.equal(options.body, '{}');
  assert.throws(() => recheckMissingMusicDecisionLibraryAdd({ decisionId: ' ' }), /requires a decisionId/u);
  await recheckMissingMusicDecisionLibraryAdd({ decisionId: 'wanted-amber' });
  assert.match(fetchMock.mock.calls[1].arguments[1].headers.get('Idempotency-Key'), /^missing-music-decisions-recheck-library-add-/u);
});

test('fetchMissingMusicDownloaderHandoff requires a non-empty decision identifier', () => {
  assert.throws(
    () => fetchMissingMusicDownloaderHandoff('  '),
    /requires a decisionId/u,
  );
});

test('selectMissingMusicDecisionMatch submits only route identifiers with CSRF and idempotency protection', async (t) => {
  const fetchMock = installFetchMock(t, { action: { downloadStarted: false } });
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-token' };
  t.after(() => {
    globalThis.document = originalDocument;
  });

  await selectMissingMusicDecisionMatch({
    decisionId: 'wanted/amber',
    idempotencyKey: 'missing-music-select-1',
    matchId: 'candidate/amber',
  });

  assert.equal(
    fetchMock.mock.calls[0].arguments[0],
    '/api/v1/missing-music/decisions/wanted%2Famber/matches/candidate%2Famber/select',
  );
  const options = fetchMock.mock.calls[0].arguments[1];
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-token');
  assert.equal(options.headers.get('Idempotency-Key'), 'missing-music-select-1');
  assert.equal(options.body, '{}');
});

test('startMissingMusicDecisionDownload submits only the decision identifier with CSRF and idempotency protection', async (t) => {
  const fetchMock = installFetchMock(t, { action: { downloadPreparationStarted: true } });
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-token' };
  t.after(() => {
    globalThis.document = originalDocument;
  });

  await startMissingMusicDecisionDownload({
    decisionId: 'wanted/amber',
    idempotencyKey: 'missing-music-download-1',
  });

  assert.equal(
    fetchMock.mock.calls[0].arguments[0],
    '/api/v1/missing-music/decisions/wanted%2Famber/start-download',
  );
  const options = fetchMock.mock.calls[0].arguments[1];
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-token');
  assert.equal(options.headers.get('Idempotency-Key'), 'missing-music-download-1');
  assert.equal(options.body, '{}');
});
