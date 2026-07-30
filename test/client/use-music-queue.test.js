/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderer, h } from 'vue';

import {
  hasActiveMusicQueueProgress,
  MUSIC_QUEUE_ACTIVE_PROGRESS_STATUSES,
  useMusicQueue,
} from '../../src/client/composables/useMusicQueue.js';

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

function mountMusicQueue(options) {
  const { createApp } = createNoopRenderer();
  const root = { children: [] };
  let musicQueue;
  const app = createApp({
    setup() {
      musicQueue = useMusicQueue({ immediate: false, pollIntervalMs: 0, ...options });
      return () => h('div');
    },
  });

  app.mount(root);
  return { app, musicQueue };
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createMusicQueueRelease({
  id = 'wanted-1',
  status = {
    code: 'pick_match',
    label: 'Pick a match',
    nextAction: 'review_matches',
    tone: 'warning',
  },
} = {}) {
  return {
    artistName: 'Forest Frank',
    expectedTrackCount: 12,
    id,
    matchedTrackCount: 0,
    missingTrackCount: 12,
    quality: { code: 'accepted', profile: { code: 'lossless_archive' } },
    releaseTitle: 'Child of God',
    status,
  };
}

test('Music Queue polls only while release progress can advance automatically', () => {
  assert.equal(hasActiveMusicQueueProgress({
    releases: [{ statusCode: 'trying_next_match' }],
  }), true);
  assert.equal(hasActiveMusicQueueProgress({
    releases: [{ status: { code: 'downloading' } }],
  }), true);
  assert.equal(hasActiveMusicQueueProgress({
    releases: [{ statusCode: 'in_library' }],
  }), false);
  assert.equal(hasActiveMusicQueueProgress({
    releases: [{ statusCode: 'quality_choice_needed' }],
  }), false);
  assert.equal(hasActiveMusicQueueProgress({ releases: [] }), false);
  assert.equal(hasActiveMusicQueueProgress(null), false);
});

test('Music Queue active progress statuses cover automatic search, recovery, download, and add work', () => {
  assert.deepEqual(MUSIC_QUEUE_ACTIVE_PROGRESS_STATUSES, [
    'adding_to_library',
    'checking_matches',
    'downloading',
    'ready_to_add',
    'searching',
    'trying_next_match',
  ]);
});

test('Music Queue keeps working, success, and failure feedback scoped to the release action', async (t) => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    addEventListener() {},
    hidden: false,
    removeEventListener() {},
  };
  t.after(() => {
    globalThis.document = originalDocument;
  });

  const fetchMusicQueueReleases = t.mock.fn(async () => ({
    pagination: { total: 0 },
    releases: [],
    summary: { counts: {}, total: 0 },
  }));
  const useMusicQueueMatch = t.mock.fn(async () => ({ ok: true }));
  const { app, musicQueue } = mountMusicQueue({ fetchMusicQueueReleases, useMusicQueueMatch });

  const action = musicQueue.useMatch({ matchId: 'match-1', wantedReleaseId: 'wanted-1' });
  assert.deepEqual(musicQueue.actionFeedback.value, {
    actionKey: 'wanted-1:match-1:use',
    message: 'Using this match...',
    phase: 'working',
    wantedReleaseId: 'wanted-1',
  });

  await action;
  assert.deepEqual(musicQueue.actionFeedback.value, {
    actionKey: 'wanted-1:match-1:use',
    message: 'Match selected. Harmoniarr will use it for the next download step.',
    phase: 'success',
    wantedReleaseId: 'wanted-1',
  });
  assert.equal(fetchMusicQueueReleases.mock.callCount(), 1);

  const rejectedMusicQueueMatch = t.mock.fn(async () => {
    throw new Error('That match is no longer available.');
  });
  const { app: failingApp, musicQueue: failingMusicQueue } = mountMusicQueue({
    fetchMusicQueueReleases,
    rejectMusicQueueMatch: rejectedMusicQueueMatch,
  });

  await failingMusicQueue.rejectMatch({ matchId: 'match-2', wantedReleaseId: 'wanted-2' });
  assert.deepEqual(failingMusicQueue.actionFeedback.value, {
    actionKey: 'wanted-2:match-2:reject',
    message: 'That match is no longer available.',
    phase: 'error',
    wantedReleaseId: 'wanted-2',
  });
  assert.equal(fetchMusicQueueReleases.mock.callCount(), 1);

  app.unmount();
  failingApp.unmount();
});

test('Music Queue applies an authoritative mutation release before its list revalidation finishes', async (t) => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    addEventListener() {},
    hidden: false,
    removeEventListener() {},
  };
  t.after(() => {
    globalThis.document = originalDocument;
  });

  const listRefresh = createDeferred();
  const priorRelease = createMusicQueueRelease();
  const updatedRelease = createMusicQueueRelease({
    status: {
      code: 'checking_matches',
      label: 'Checking matches',
      nextAction: 'download_now',
      tone: 'info',
    },
  });
  const fetchMusicQueueReleases = t.mock.fn(() => listRefresh.promise);
  const useMusicQueueMatch = t.mock.fn(async () => ({ ok: true, release: updatedRelease }));
  const { app, musicQueue } = mountMusicQueue({ fetchMusicQueueReleases, useMusicQueueMatch });
  musicQueue.data.value = {
    pagination: { total: 1 },
    releases: [priorRelease],
    summary: { counts: { pick_match: 1 }, total: 1 },
  };

  const action = musicQueue.useMatch({ matchId: 'match-1', wantedReleaseId: 'wanted-1' });
  while (fetchMusicQueueReleases.mock.callCount() === 0) {
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
  }

  assert.equal(musicQueue.releases.value[0].statusCode, 'checking_matches');
  assert.deepEqual(musicQueue.releases.value[0].status, updatedRelease.status);

  listRefresh.resolve({
    pagination: { total: 1 },
    releases: [updatedRelease],
    summary: { counts: { checking_matches: 1 }, total: 1 },
  });
  await action;
  app.unmount();
});
