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

import { computed, getCurrentScope, onScopeDispose, ref } from 'vue';
import { batchResolveArtwork as defaultBatchResolve } from '../lib/artwork-api.js';

import { createArtworkBatchResolver } from '../lib/artwork-batch-resolver.js';

export function useArtworkBatchResolve({
  batchResolveFn = defaultBatchResolve,
} = {}) {
  const artworkMap = ref({});
  const pendingCalls = ref(0);
  const isResolving = computed(() => pendingCalls.value > 0);
  const { resolveBatches } = createArtworkBatchResolver({ batchResolveFn });
  let generation = 0;
  let disposed = false;

  function buildKey(ownerType, ownerId, artworkRole) {
    return `${ownerType}:${ownerId}:${artworkRole ?? 'cover_front'}`;
  }

  function getResolved(ownerType, ownerId, artworkRole = 'cover_front') {
    return artworkMap.value[buildKey(ownerType, ownerId, artworkRole)] ?? null;
  }

  async function resolve(requests) {
    if (disposed || !Array.isArray(requests) || requests.length === 0) return;
    const token = generation;
    pendingCalls.value += 1;
    try {
      return await resolveBatches(requests, {
        shouldContinue: () => !disposed && token === generation,
        onResolved: (resolved) => { artworkMap.value = { ...artworkMap.value, ...resolved }; },
      });
    } finally {
      if (token === generation) pendingCalls.value -= 1;
    }
  }

  function clear() {
    generation += 1;
    pendingCalls.value = 0;
    artworkMap.value = {};
  }

  if (getCurrentScope()) onScopeDispose(() => {
    disposed = true;
    clear();
  });

  return { artworkMap, clear, getResolved, isResolving, resolve };
}
