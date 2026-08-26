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
  fetchMissingMusicDecisionDetail,
  fetchMissingMusicDecisions,
  selectMissingMusicDecisionMatch,
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

test('fetchMissingMusicDecisions sends only bounded worklist filter values', async (t) => {
  const fetchMock = installFetchMock(t);

  await fetchMissingMusicDecisions({
    accountStatus: 'disabled',
    limit: 25,
    offset: 10,
    q: 'Autechre & Amber',
    requestedForUserId: 'user/2',
    scope: 'all',
    state: 'action',
  });

  assert.equal(
    fetchMock.mock.calls[0].arguments[0],
    '/api/v1/missing-music/decisions?accountStatus=disabled&limit=25&offset=10&q=Autechre+%26+Amber&requestedForUserId=user%2F2&scope=all&state=action',
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
