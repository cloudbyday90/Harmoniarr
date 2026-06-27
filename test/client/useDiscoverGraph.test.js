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

test('hydrateRecommendationInputs adds all monitored artists immediately before similarity fetches resolve', async () => {
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
    hasRecommendationInputs,
    hydrateRecommendationInputs,
    isAnyRecommendationInputLoading,
    recommendationInputs,
  } = useDiscoverGraph({ fetchSimilar });

  const hydration = hydrateRecommendationInputs([
    { id: 'lauren', name: 'Lauren Daigle' },
    { id: 'bebo', name: 'Bebo Norman' },
  ]);

  assert.equal(hasRecommendationInputs.value, true);
  assert.equal(isAnyRecommendationInputLoading.value, true);
  assert.deepEqual(
    recommendationInputs.value.map((artist) => artist.name),
    ['Lauren Daigle', 'Bebo Norman'],
  );

  laurenDeferred.resolve({ similar: [] });
  beboDeferred.resolve({ similar: [] });
  await hydration;

  assert.equal(isAnyRecommendationInputLoading.value, false);
});

test('removeRecommendationInput ignores stale in-flight similarity results', async () => {
  const deferred = createDeferred();
  const {
    addRecommendationInput,
    hasSuggestions,
    removeRecommendationInput,
    recommendationInputs,
    suggestions,
  } = useDiscoverGraph({
    fetchSimilar: async () => deferred.promise,
  });

  const load = addRecommendationInput({ id: 'input-artist', name: 'Input Artist' });
  assert.deepEqual(recommendationInputs.value.map((artist) => artist.id), ['input-artist']);

  removeRecommendationInput('input-artist');
  assert.deepEqual(recommendationInputs.value, []);

  deferred.resolve({
    similar: [{ id: 'similar-artist', name: 'Similar Artist', score: 0.91 }],
  });
  await load;

  assert.equal(hasSuggestions.value, false);
  assert.deepEqual(suggestions.value, []);
});

test('setRecommendationFocusIds narrows suggestions without removing monitored artists', async () => {
  const {
    focusedRecommendationInputs,
    isRecommendationFocusFiltered,
    recommendationFocusIds,
    recommendationInputs,
    setRecommendationFocusIds,
    suggestions,
    hydrateRecommendationInputs,
  } = useDiscoverGraph({
    fetchSimilar: async (artistId) => {
      if (artistId === 'boards') {
        return {
          similar: [
            { id: 'aphex', name: 'Aphex Twin', score: 0.7 },
            { id: 'tycho', name: 'Tycho', score: 0.5 },
          ],
        };
      }

      if (artistId === 'autechre') {
        return {
          similar: [
            { id: 'aphex', name: 'Aphex Twin', score: 0.9 },
          ],
        };
      }

      throw new Error(`Unexpected artist id ${artistId}`);
    },
  });

  await hydrateRecommendationInputs([
    { id: 'boards', name: 'Boards of Canada' },
    { id: 'autechre', name: 'Autechre' },
  ]);

  assert.deepEqual(recommendationInputs.value.map((artist) => artist.id), ['boards', 'autechre']);
  assert.equal(suggestions.value.find((suggestion) => suggestion.id === 'aphex')?.inputCount, 2);

  setRecommendationFocusIds(['boards']);

  assert.equal(isRecommendationFocusFiltered.value, true);
  assert.deepEqual(recommendationFocusIds.value, ['boards']);
  assert.deepEqual(focusedRecommendationInputs.value.map((artist) => artist.id), ['boards']);
  assert.equal(suggestions.value.find((suggestion) => suggestion.id === 'aphex')?.inputCount, 1);
  assert.deepEqual(
    suggestions.value.map((suggestion) => suggestion.id),
    ['aphex', 'tycho'],
  );
});

test('removeRecommendationInput prunes stale recommendation focus ids', async () => {
  const {
    hydrateRecommendationInputs,
    recommendationFocusIds,
    removeRecommendationInput,
    setRecommendationFocusIds,
  } = useDiscoverGraph({
    fetchSimilar: async () => ({ similar: [] }),
  });

  await hydrateRecommendationInputs([
    { id: 'boards', name: 'Boards of Canada' },
    { id: 'autechre', name: 'Autechre' },
  ]);
  setRecommendationFocusIds(['boards', 'autechre']);

  removeRecommendationInput('boards');

  assert.deepEqual(recommendationFocusIds.value, ['autechre']);
});
