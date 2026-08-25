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
import { createRenderer, h, nextTick, ref } from 'vue';
import { useAcquisitionOverview } from '../../src/client/composables/useAcquisitionOverview.js';

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

function createMusicQueuePayload() {
  return {
    pagination: { total: 1 },
    releases: [{
      artistName: 'Shared Artist',
      expectedTrackCount: 10,
      id: 'wanted-1',
      matchedTrackCount: 0,
      missingTrackCount: 10,
      quality: { code: 'accepted', profile: { code: 'lossless_archive' } },
      releaseTitle: 'Shared Release',
      status: {
        code: 'downloading',
        label: 'Downloading',
        nextAction: 'open_downloader',
        tone: 'info',
      },
    }],
    summary: { counts: { downloading: 1 }, total: 1 },
  };
}

function mountAcquisitionOverview(options) {
  const { createApp } = createNoopRenderer();
  const root = { children: [] };
  let overview;
  const app = createApp({
    setup() {
      overview = useAcquisitionOverview(options);
      return () => h('div');
    },
  });

  app.mount(root);
  return { app, overview };
}

test('Acquisition overview never requests the admin Downloader read for a non-admin session', async (t) => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    addEventListener() {},
    hidden: false,
    removeEventListener() {},
  };
  t.after(() => {
    globalThis.document = originalDocument;
  });

  const fetchMusicQueueReleases = t.mock.fn(async () => createMusicQueuePayload());
  const fetchDownloaderQueue = t.mock.fn(async () => ({ transfers: [] }));
  const { app, overview } = mountAcquisitionOverview({
    canViewDownloader: false,
    fetchDownloaderQueue,
    musicQueueOptions: {
      fetchMusicQueueReleases,
      immediate: false,
      pollIntervalMs: 0,
    },
  });

  await overview.refresh();

  assert.equal(fetchMusicQueueReleases.mock.callCount(), 1);
  assert.equal(fetchDownloaderQueue.mock.callCount(), 0);
  assert.equal(overview.canViewDownloads.value, false);
  app.unmount();
});

test('Acquisition overview begins the protected read only after administrator visibility is granted', async (t) => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    addEventListener() {},
    hidden: false,
    removeEventListener() {},
  };
  t.after(() => {
    globalThis.document = originalDocument;
  });

  const canViewDownloader = ref(false);
  const fetchMusicQueueReleases = t.mock.fn(async () => createMusicQueuePayload());
  const fetchDownloaderQueue = t.mock.fn(async () => ({
    providerState: { enabled: true },
    queueHealth: { counts: { active: 1, queued: 0 } },
    transfers: [],
  }));
  const { app, overview } = mountAcquisitionOverview({
    canViewDownloader,
    fetchDownloaderQueue,
    musicQueueOptions: {
      fetchMusicQueueReleases,
      immediate: false,
      pollIntervalMs: 0,
    },
  });

  canViewDownloader.value = true;
  await nextTick();
  await Promise.resolve();

  assert.equal(fetchDownloaderQueue.mock.callCount(), 1);
  assert.equal(overview.canViewDownloads.value, true);
  assert.equal(overview.downloaderQueue.value.queueHealth.counts.active, 1);
  app.unmount();
});
