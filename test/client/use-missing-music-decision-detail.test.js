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
import { createRenderer, h, ref } from 'vue';
import {
  isMissingMusicDecisionNotFoundError,
  useMissingMusicDecisionDetail,
} from '../../src/client/composables/useMissingMusicDecisionDetail.js';

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

function mountDecisionDetail(options) {
  const { createApp } = createNoopRenderer();
  const root = { children: [] };
  let decisionDetail;
  const app = createApp({
    setup() {
      decisionDetail = useMissingMusicDecisionDetail({ immediate: false, ...options });
      return () => h('div');
    },
  });

  app.mount(root);
  return { app, decisionDetail };
}

function createDetail(decisionId = 'wanted-amber') {
  return {
    checkedAt: '2026-08-26T16:30:00.000Z',
    decision: {
      decisionId,
      requestedFor: { username: 'Jamie' },
      release: { title: 'Amber' },
    },
    permissions: { isReadOnly: false },
    scope: 'all',
  };
}

test('useMissingMusicDecisionDetail reads a scoped release projection by route identifier', async (t) => {
  const decisionId = ref('wanted-amber');
  const fetchMissingMusicDecisionDetail = t.mock.fn(async (id) => createDetail(id));
  const { app, decisionDetail } = mountDecisionDetail({
    decisionId,
    fetchMissingMusicDecisionDetail,
  });

  await decisionDetail.load();

  assert.equal(fetchMissingMusicDecisionDetail.mock.callCount(), 1);
  assert.equal(fetchMissingMusicDecisionDetail.mock.calls[0].arguments[0], 'wanted-amber');
  assert.equal(decisionDetail.detail.value.decision.decisionId, 'wanted-amber');
  assert.equal(decisionDetail.detailDecisionId.value, 'wanted-amber');
  assert.equal(decisionDetail.isNotFound.value, false);
  app.unmount();
});

test('useMissingMusicDecisionDetail turns a scoped not-found response into an unavailable state', async () => {
  const decisionId = ref('wanted-other-user');
  const fetchMissingMusicDecisionDetail = async () => {
    const error = new Error('Missing Music release was not found');
    error.code = 'missing_music_decision_not_found';
    error.status = 404;
    throw error;
  };
  const { app, decisionDetail } = mountDecisionDetail({
    decisionId,
    fetchMissingMusicDecisionDetail,
  });

  await decisionDetail.load();

  assert.equal(decisionDetail.detail.value, null);
  assert.equal(decisionDetail.detailDecisionId.value, 'wanted-other-user');
  assert.equal(decisionDetail.isNotFound.value, true);
  assert.equal(decisionDetail.errorMessage.value, '');
  assert.equal(
    isMissingMusicDecisionNotFoundError({ code: 'missing_music_decision_not_found', status: 404 }),
    true,
  );
  app.unmount();
});
