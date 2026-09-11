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
import { createRenderer, h } from 'vue';
import { useMissingMusicDecisions } from '../../src/client/composables/useMissingMusicDecisions.js';

function createNoopRenderer() {
  return createRenderer({
    createComment: (text) => ({ text }),
    createElement: (type) => ({ children: [], type }),
    createText: (text) => ({ text }),
    insert: (child, parent) => { parent.children.push(child); },
    nextSibling: () => null,
    parentNode: () => null,
    patchProp: (node, key, _previousValue, nextValue) => { node[key] = nextValue; },
    remove: () => {},
    setElementText: (node, text) => { node.text = text; },
    setText: (node, text) => { node.text = text; },
  });
}

function mountMissingMusicDecisions(options) {
  const { createApp } = createNoopRenderer();
  const root = { children: [] };
  let decisions;
  const app = createApp({
    setup() {
      decisions = useMissingMusicDecisions({
        immediate: false,
        pollIntervalMs: 0,
        revalidateOnFocus: false,
        ...options,
      });
      return () => h('div');
    },
  });
  app.mount(root);
  return { app, decisions };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function pagePayload(id, nextCursor = null) {
  return {
    decisions: id ? [{ decisionId: id }] : [], scope: 'all', users: [],
    page: { limit: 50, total: null, hasMore: Boolean(nextCursor), nextCursor },
  };
}

test('cursor navigation commits only successful pages and retains empty-page continuation', async (t) => {
  let failNext = false;
  const requests = [];
  const { app, decisions } = mountMissingMusicDecisions({ fetchMissingMusicDecisions: async (filters) => {
    requests.push(filters);
    if (failNext) { failNext = false; throw new Error('Temporary read failure'); }
    if (filters.cursor === 'second') return pagePayload(null, 'third');
    if (filters.cursor === 'third') return pagePayload('last');
    return pagePayload('first', 'second');
  } });
  t.after(() => app.unmount());
  await decisions.refresh();
  failNext = true;
  assert.equal(await decisions.nextPage(), false);
  assert.equal(decisions.pageNumber.value, 1);
  assert.deepEqual(decisions.decisions.value, [{ decisionId: 'first' }]);
  assert.equal(await decisions.nextPage(), true);
  assert.equal(decisions.pageNumber.value, 2);
  assert.deepEqual(decisions.decisions.value, []);
  assert.equal(decisions.canGoNext.value, true);
  await decisions.refresh();
  assert.equal(requests.at(-1).cursor, 'second', 'Refresh preserves the current cursor');
  await decisions.nextPage();
  assert.equal(decisions.canGoNext.value, false);
  assert.equal(decisions.pageNumber.value, 3);
  await decisions.previousPage();
  assert.equal(requests.at(-1).cursor, 'second');
  assert.equal(decisions.pageNumber.value, 2);
  await decisions.firstPage();
  assert.equal(requests.at(-1).cursor, undefined);
  assert.equal(decisions.canGoPrevious.value, false);
  await decisions.nextPage();
  await decisions.applyFilters({ requestedForUserId: 'another-user', q: 'Narrow search' });
  assert.equal(requests.at(-1).cursor, undefined);
  assert.equal(decisions.pageNumber.value, 1);
});

test('late success and error cannot replace newer filters, loading flags, or cursor history', async (t) => {
  const pending = [];
  const { app, decisions } = mountMissingMusicDecisions({ fetchMissingMusicDecisions: (filters, { signal }) => {
    const request = deferred();
    pending.push({ ...request, filters, signal });
    return request.promise;
  } });
  t.after(() => app.unmount());
  const original = decisions.refresh();
  pending[0].resolve(pagePayload('old-recipient', 'old-cursor'));
  await original;
  const next = decisions.nextPage();
  const changed = decisions.applyFilters({ requestedForUserId: 'new-recipient' });
  assert.equal(pending[1].signal.aborted, true);
  assert.deepEqual(decisions.decisions.value, [], 'Old recipient rows disappear immediately');
  pending[1].resolve(pagePayload('late-old-row', 'late-cursor'));
  await next;
  assert.equal(decisions.isLoading.value, true);
  assert.equal(decisions.pageNumber.value, 1);
  pending[2].resolve(pagePayload('new-row'));
  await changed;
  assert.deepEqual(decisions.decisions.value, [{ decisionId: 'new-row' }]);
  const outdatedRefresh = decisions.refresh();
  const latest = decisions.applyFilters({ state: 'ready' });
  pending[4].resolve(pagePayload('ready-row'));
  await latest;
  pending[3].reject(new Error('Stale failure'));
  await outdatedRefresh;
  assert.equal(decisions.errorMessage.value, '');
  assert.equal(decisions.isLoading.value, false);
  assert.deepEqual(decisions.decisions.value, [{ decisionId: 'ready-row' }]);
});

test('unmount aborts pending page work and prevents late commits', async () => {
  const pending = deferred();
  let signal;
  const { app, decisions } = mountMissingMusicDecisions({ fetchMissingMusicDecisions: (_filters, options) => {
    signal = options.signal;
    return pending.promise;
  } });
  const result = decisions.refresh();
  app.unmount();
  assert.equal(signal.aborted, true);
  pending.resolve(pagePayload('too-late', 'late-cursor'));
  assert.equal(await result, false);
  assert.deepEqual(decisions.decisions.value, []);
  assert.equal(decisions.canGoNext.value, false);
});

test('useMissingMusicDecisions reads the server-authorized all-user worklist without client fan-out', async (t) => {
  const fetchMissingMusicDecisions = t.mock.fn(async (filters) => ({
    decisions: [{ decisionId: 'wanted-1' }],
    filters,
    page: { limit: 50, offset: 0, sourceLimitReached: false, total: 1 },
    scope: 'all',
    users: [{ accountStatus: 'active', id: 'jamie', username: 'Jamie' }],
  }));
  const { app, decisions } = mountMissingMusicDecisions({ fetchMissingMusicDecisions });

  await decisions.refresh();

  assert.equal(fetchMissingMusicDecisions.mock.callCount(), 1);
  assert.deepEqual(fetchMissingMusicDecisions.mock.calls[0].arguments[0], {
    accountStatus: 'active',
    limit: 50,
    offset: 0,
    q: '',
    requestedForUserId: '',
    scope: 'all',
    state: 'action',
  });
  assert.equal(decisions.scope.value, 'all');
  assert.deepEqual(decisions.users.value, [{ accountStatus: 'active', id: 'jamie', username: 'Jamie' }]);

  app.unmount();
});

test('useMissingMusicDecisions resets paging when a filter changes', async (t) => {
  const fetchMissingMusicDecisions = t.mock.fn(async (filters) => ({
    decisions: [],
    filters,
    page: { limit: 50, offset: 0, sourceLimitReached: false, total: 0 },
    scope: 'mine',
    users: [],
  }));
  const { app, decisions } = mountMissingMusicDecisions({
    fetchMissingMusicDecisions,
    initialFilters: { offset: 50, q: 'Old query', state: 'all' },
  });

  await decisions.applyFilters({ q: 'Autechre', state: 'searching' });

  assert.deepEqual(fetchMissingMusicDecisions.mock.calls[0].arguments[0], {
    accountStatus: 'active',
    limit: 50,
    offset: 0,
    q: 'Autechre',
    requestedForUserId: '',
    scope: 'all',
    state: 'searching',
  });

  app.unmount();
});
