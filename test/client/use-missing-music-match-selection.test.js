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
import { useMissingMusicMatchSelection } from '../../src/client/composables/useMissingMusicMatchSelection.js';

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

function mountMatchSelection(options) {
  const { createApp } = createNoopRenderer();
  const root = { children: [] };
  let selection;
  const app = createApp({
    setup() {
      selection = useMissingMusicMatchSelection(options);
      return () => h('div');
    },
  });
  app.mount(root);
  return { app, selection };
}

test('useMissingMusicMatchSelection reports a selection without claiming that download started', async (t) => {
  const selectMissingMusicDecisionMatch = t.mock.fn(async () => ({
    action: { downloadStarted: false },
  }));
  const retryIdempotencyKeyStore = {
    clear: t.mock.fn(),
    getOrCreate: t.mock.fn(() => 'retry-key'),
  };
  const { app, selection } = mountMatchSelection({
    retryIdempotencyKeyStore,
    selectMissingMusicDecisionMatch,
  });

  const result = await selection.selectMatch({ decisionId: 'wanted-amber', matchId: 'candidate-amber' });

  assert.deepEqual(result, { action: { downloadStarted: false } });
  assert.deepEqual(selectMissingMusicDecisionMatch.mock.calls[0].arguments[0], {
    decisionId: 'wanted-amber',
    idempotencyKey: 'retry-key',
    matchId: 'candidate-amber',
  });
  assert.equal(selection.statusMessage.value, 'Match selected. Download has not started.');
  assert.equal(selection.activeMatchId.value, '');
  app.unmount();
});

test('useMissingMusicMatchSelection retains its key for an unconfirmed transport retry', async (t) => {
  const retryIdempotencyKeyStore = {
    clear: t.mock.fn(),
    getOrCreate: t.mock.fn(() => 'retry-key'),
  };
  const selectMissingMusicDecisionMatch = t.mock.fn(async () => {
    throw new Error('Connection closed');
  });
  const { app, selection } = mountMatchSelection({
    retryIdempotencyKeyStore,
    selectMissingMusicDecisionMatch,
  });

  await selection.selectMatch({ decisionId: 'wanted-amber', matchId: 'candidate-amber' });

  assert.equal(retryIdempotencyKeyStore.clear.mock.callCount(), 0);
  assert.equal(selection.errorMessage.value, 'Connection closed');
  app.unmount();
});
