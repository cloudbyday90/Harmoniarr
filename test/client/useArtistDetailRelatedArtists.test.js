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
import { useArtistDetailRelatedArtists } from '../../src/client/composables/useArtistDetailRelatedArtists.js';

function createDeferred() {
  let reject;
  let resolve;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

async function flushAsyncWork() {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

test('useArtistDetailRelatedArtists exposes a dedicated loading state while enrichment is pending', async () => {
  const deferred = createDeferred();
  const related = useArtistDetailRelatedArtists({
    fetchSimilar: () => deferred.promise,
  });

  const loading = related.loadRelatedArtists('artist-1');

  assert.equal(related.isLoadingRelatedArtists.value, true);
  assert.deepEqual(related.relatedArtists.value, []);

  deferred.resolve({ similar: [{ id: 'artist-2', name: 'Related artist' }] });
  await loading;

  assert.equal(related.isLoadingRelatedArtists.value, false);
  assert.equal(related.relatedArtists.value[0].id, 'artist-2');
});

test('useArtistDetailRelatedArtists ignores stale responses after invalidation', async () => {
  const deferred = createDeferred();
  const related = useArtistDetailRelatedArtists({
    fetchSimilar: () => deferred.promise,
  });

  void related.loadRelatedArtists('artist-1');
  related.invalidateRelatedArtists();
  deferred.resolve({ similar: [{ id: 'stale-artist', name: 'Stale artist' }] });
  await flushAsyncWork();

  assert.equal(related.isLoadingRelatedArtists.value, false);
  assert.deepEqual(related.relatedArtists.value, []);
});
