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
import { useMissingMusicDownloadStart } from '../../src/client/composables/useMissingMusicDownloadStart.js';

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

function mountDownloadStart(options) {
  const { createApp } = createNoopRenderer();
  const root = { children: [] };
  let downloadStart;
  const app = createApp({
    setup() {
      downloadStart = useMissingMusicDownloadStart(options);
      return () => h('div');
    },
  });
  app.mount(root);
  return { app, downloadStart };
}

test('useMissingMusicDownloadStart reports queued preparation without claiming provider acceptance', async (t) => {
  const retryIdempotencyKeyStore = {
    clear: t.mock.fn(),
    getOrCreate: t.mock.fn(() => 'retry-key'),
  };
  const startMissingMusicDecisionDownload = t.mock.fn(async () => ({
    action: { downloadPreparationStarted: true },
  }));
  const { app, downloadStart } = mountDownloadStart({
    retryIdempotencyKeyStore,
    startMissingMusicDecisionDownload,
  });

  const result = await downloadStart.startDownload({ decisionId: 'wanted-amber' });

  assert.deepEqual(result, { action: { downloadPreparationStarted: true } });
  assert.deepEqual(startMissingMusicDecisionDownload.mock.calls[0].arguments[0], {
    decisionId: 'wanted-amber',
    idempotencyKey: 'retry-key',
  });
  assert.equal(
    downloadStart.statusMessage.value,
    'Download preparation started. Transfer progress will appear in Downloader after it is submitted.',
  );
  assert.equal(downloadStart.isStarting.value, false);
  app.unmount();
});

test('useMissingMusicDownloadStart retains its key for an unconfirmed transport retry', async (t) => {
  const retryIdempotencyKeyStore = {
    clear: t.mock.fn(),
    getOrCreate: t.mock.fn(() => 'retry-key'),
  };
  const { app, downloadStart } = mountDownloadStart({
    retryIdempotencyKeyStore,
    startMissingMusicDecisionDownload: async () => {
      throw new Error('Connection closed');
    },
  });

  await downloadStart.startDownload({ decisionId: 'wanted-amber' });

  assert.equal(retryIdempotencyKeyStore.clear.mock.callCount(), 0);
  assert.equal(downloadStart.errorMessage.value, 'Connection closed');
  app.unmount();
});
