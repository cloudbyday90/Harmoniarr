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
import { useDiscoverGraph } from '../../src/client/composables/useDiscoverGraph.js';

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('hydrateSeeds adds all monitored artists immediately before similarity fetches resolve', async () => {
  const laurenDeferred = createDeferred();
  const beboDeferred = createDeferred();
  const fetchSimilar = async (artistId) => {
    if (artistId === 'lauren') {
      return laurenDeferred.promise;
    }

    if (artistId === 'bebo') {
      return beboDeferred.promise;
    }

    throw new Error(`Unexpected artist id ${artistId}`);
  };

  const {
    hasSeeds,
    hydrateSeeds,
    isAnySeedLoading,
    seeds,
  } = useDiscoverGraph({ fetchSimilar });

  const hydration = hydrateSeeds([
    { id: 'lauren', name: 'Lauren Daigle' },
    { id: 'bebo', name: 'Bebo Norman' },
  ]);

  assert.equal(hasSeeds.value, true);
  assert.equal(isAnySeedLoading.value, true);
  assert.deepEqual(
    seeds.value.map((artist) => artist.name),
    ['Lauren Daigle', 'Bebo Norman'],
  );

  laurenDeferred.resolve({ similar: [] });
  beboDeferred.resolve({ similar: [] });
  await hydration;

  assert.equal(isAnySeedLoading.value, false);
});

test('removeSeed ignores stale in-flight similarity results', async () => {
  const deferred = createDeferred();
  const {
    addSeed,
    hasSuggestions,
    removeSeed,
    seeds,
    suggestions,
  } = useDiscoverGraph({
    fetchSimilar: async () => deferred.promise,
  });

  const load = addSeed({ id: 'seed-artist', name: 'Seed Artist' });
  assert.deepEqual(seeds.value.map((artist) => artist.id), ['seed-artist']);

  removeSeed('seed-artist');
  assert.deepEqual(seeds.value, []);

  deferred.resolve({
    similar: [{ id: 'similar-artist', name: 'Similar Artist', score: 0.91 }],
  });
  await load;

  assert.equal(hasSuggestions.value, false);
  assert.deepEqual(suggestions.value, []);
});

