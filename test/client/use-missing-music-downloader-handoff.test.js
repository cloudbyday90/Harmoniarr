import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderer, h, ref } from 'vue';
import {
  isMissingMusicDownloaderHandoffUnavailableError,
  useMissingMusicDownloaderHandoff,
} from '../../src/client/composables/useMissingMusicDownloaderHandoff.js';

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

function mountHandoff(options) {
  const { createApp } = createNoopRenderer();
  const root = { children: [] };
  let downloaderHandoff;
  const app = createApp({
    setup() {
      downloaderHandoff = useMissingMusicDownloaderHandoff(options);
      return () => h('div');
    },
  });

  app.mount(root);
  return { app, downloaderHandoff };
}

function createHandoff(decisionId = 'wanted-amber') {
  return {
    decisionId,
    release: { artistName: 'Autechre', title: 'Amber' },
    requestedFor: { username: 'Jamie' },
    wantedReleaseId: decisionId,
  };
}

test('useMissingMusicDownloaderHandoff resolves server-issued release context from the route decision ID', async () => {
  const decisionId = ref('wanted-amber');
  const fetchMissingMusicDownloaderHandoff = test.mock.fn(async (id) => createHandoff(id));
  const { app, downloaderHandoff } = mountHandoff({
    decisionId,
    fetchMissingMusicDownloaderHandoff,
  });

  await downloaderHandoff.load();

  assert.equal(fetchMissingMusicDownloaderHandoff.mock.calls[0].arguments[0], 'wanted-amber');
  assert.deepEqual(downloaderHandoff.handoff.value, createHandoff());
  assert.equal(downloaderHandoff.isUnavailable.value, false);
  app.unmount();
});

test('useMissingMusicDownloaderHandoff keeps an unavailable decision out of the broad transfer view', async () => {
  const fetchMissingMusicDownloaderHandoff = async () => {
    const error = new Error('This Missing Music release does not currently have a download to view');
    error.code = 'missing_music_downloader_unavailable';
    error.status = 409;
    throw error;
  };
  const { app, downloaderHandoff } = mountHandoff({
    decisionId: ref('wanted-amber'),
    fetchMissingMusicDownloaderHandoff,
  });

  await downloaderHandoff.load();

  assert.equal(downloaderHandoff.handoff.value, null);
  assert.equal(downloaderHandoff.isUnavailable.value, true);
  assert.equal(downloaderHandoff.errorMessage.value, '');
  assert.equal(
    isMissingMusicDownloaderHandoffUnavailableError({
      code: 'missing_music_downloader_unavailable',
      status: 409,
    }),
    true,
  );
  app.unmount();
});
