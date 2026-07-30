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
  isMusicQueueReleaseNotFoundError,
  useMusicQueueReleaseDetail,
} from '../../src/client/composables/useMusicQueueReleaseDetail.js';

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

function createRelease(id = 'wanted-1') {
  return {
    artistName: 'Shared Artist',
    expectedTrackCount: 10,
    id,
    matchedTrackCount: 0,
    missingTrackCount: 10,
    quality: { code: 'accepted', profile: { code: 'lossless_archive' }, tone: 'success' },
    releaseGroupType: 'Album',
    releaseTitle: 'Shared Release',
    status: {
      code: 'downloading',
      detail: 'Harmoniarr is downloading the shared release now.',
      label: 'Downloading',
      nextAction: 'open_downloader',
      tone: 'info',
    },
  };
}

function mountReleaseDetail(options) {
  const { createApp } = createNoopRenderer();
  const root = { children: [] };
  let releaseDetail;
  const app = createApp({
    setup() {
      releaseDetail = useMusicQueueReleaseDetail({ immediate: false, ...options });
      return () => h('div');
    },
  });

  app.mount(root);
  return { app, releaseDetail };
}

test('Music Queue release detail keeps a scoped direct read separate from the queue list', async () => {
  const wantedReleaseId = ref('wanted-1');
  const fetchMusicQueueRelease = test.mock.fn(async (id) => ({ release: createRelease(id) }));
  const { app, releaseDetail } = mountReleaseDetail({ fetchMusicQueueRelease, wantedReleaseId });

  await releaseDetail.load();

  assert.equal(fetchMusicQueueRelease.mock.callCount(), 1);
  assert.equal(releaseDetail.release.value.id, 'wanted-1');
  assert.equal(releaseDetail.release.value.statusCode, 'downloading');
  assert.equal(releaseDetail.isNotFound.value, false);
  assert.equal(releaseDetail.errorMessage.value, '');
  app.unmount();
});

test('Music Queue release detail turns scoped 404s into a generic unavailable state', async () => {
  const wantedReleaseId = ref('wanted-other-operator');
  const fetchMusicQueueRelease = test.mock.fn(async () => {
    const error = new Error('Music Queue release was not found');
    error.code = 'music_queue_release_not_found';
    error.status = 404;
    throw error;
  });
  const { app, releaseDetail } = mountReleaseDetail({ fetchMusicQueueRelease, wantedReleaseId });

  await releaseDetail.load();

  assert.equal(releaseDetail.release.value, null);
  assert.equal(releaseDetail.isNotFound.value, true);
  assert.equal(releaseDetail.errorMessage.value, '');
  assert.equal(isMusicQueueReleaseNotFoundError({ code: 'music_queue_release_not_found', status: 404 }), true);
  assert.equal(isMusicQueueReleaseNotFoundError({ code: 'music_queue_release_not_found', status: 403 }), false);
  app.unmount();
});

test('Music Queue release detail preserves non-authorization failures for the normal error boundary', async () => {
  const wantedReleaseId = ref('wanted-1');
  const fetchMusicQueueRelease = test.mock.fn(async () => {
    throw new Error('Music Queue release failed to load');
  });
  const { app, releaseDetail } = mountReleaseDetail({ fetchMusicQueueRelease, wantedReleaseId });

  await releaseDetail.load();

  assert.equal(releaseDetail.release.value, null);
  assert.equal(releaseDetail.isNotFound.value, false);
  assert.equal(releaseDetail.errorMessage.value, 'Music Queue release failed to load');
  app.unmount();
});
