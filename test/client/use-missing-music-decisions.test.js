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
