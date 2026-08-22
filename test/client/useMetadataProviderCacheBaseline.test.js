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
import { useMetadataProviderCacheBaseline } from '../../src/client/composables/useMetadataProviderCacheBaseline.js';

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

function mountMetadataProviderCacheBaseline(options) {
  const { createApp } = createNoopRenderer();
  const root = { children: [] };
  let workflow;
  const app = createApp({
    setup() {
      workflow = useMetadataProviderCacheBaseline(options);
      return () => h('div');
    },
  });

  app.mount(root);
  return { app, workflow };
}

test('useMetadataProviderCacheBaseline waits for an explicit load and projects the protected response', async (t) => {
  const fetchMetadataProviderCacheObservability = t.mock.fn(async () => ({
    cache: {
      namespaces: [{
        cacheNamespace: 'musicbrainz.artist_release_groups',
        cacheStoreErrors: { read: 0, write: 0 },
        lookups: { cold: 1, fresh: 3, stale: 0 },
        refreshes: {},
      }],
      observedSinceAt: '2026-08-22T12:00:00.000Z',
      updatedAt: '2026-08-22T12:01:00.000Z',
    },
  }));
  const { app, workflow } = mountMetadataProviderCacheBaseline({ fetchMetadataProviderCacheObservability });
  t.after(() => app.unmount());

  assert.equal(fetchMetadataProviderCacheObservability.mock.callCount(), 0);
  assert.equal(workflow.cacheBaseline.value, null);
  assert.equal(workflow.isLoading.value, false);

  await workflow.loadCacheBaseline();

  assert.equal(fetchMetadataProviderCacheObservability.mock.callCount(), 1);
  assert.equal(workflow.cacheBaseline.value.namespaces[0].cacheServedRatePercent, 75);
  assert.equal(workflow.errorMessage.value, '');
});

test('useMetadataProviderCacheBaseline keeps the prior sample when a manual refresh fails', async (t) => {
  let shouldFail = false;
  const { app, workflow } = mountMetadataProviderCacheBaseline({
    fetchMetadataProviderCacheObservability: async () => {
      if (shouldFail) {
        throw new Error('Fresh administrator sign-in required');
      }

      return {
        cache: {
          namespaces: [],
          observedSinceAt: '2026-08-22T12:00:00.000Z',
          updatedAt: null,
        },
      };
    },
  });
  t.after(() => app.unmount());

  await workflow.loadCacheBaseline();
  shouldFail = true;
  await workflow.loadCacheBaseline();

  assert.deepEqual(workflow.cacheBaseline.value.namespaces, []);
  assert.equal(workflow.errorMessage.value, 'Fresh administrator sign-in required');
});
