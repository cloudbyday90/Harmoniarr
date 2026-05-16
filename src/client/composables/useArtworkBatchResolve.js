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

import { ref } from 'vue';
import { batchResolveArtwork as defaultBatchResolve } from '../lib/artwork-api.js';

const BATCH_LIMIT = 50;

export function useArtworkBatchResolve({
  batchResolveFn = defaultBatchResolve,
} = {}) {
  const artworkMap = ref({});
  const isResolving = ref(false);

  function buildKey(ownerType, ownerId, artworkRole) {
    return `${ownerType}:${ownerId}:${artworkRole ?? 'cover_front'}`;
  }

  function getResolved(ownerType, ownerId, artworkRole = 'cover_front') {
    return artworkMap.value[buildKey(ownerType, ownerId, artworkRole)] ?? null;
  }

  async function resolve(requests) {
    if (!requests || requests.length === 0) return;

    isResolving.value = true;

    const batches = [];
    for (let i = 0; i < requests.length; i += BATCH_LIMIT) {
      batches.push(requests.slice(i, i + BATCH_LIMIT));
    }

    try {
      const allResults = await Promise.all(
        batches.map((batch) => batchResolveFn(batch)),
      );

      const merged = { ...artworkMap.value };
      for (const { resolved } of allResults) {
        Object.assign(merged, resolved);
      }
      artworkMap.value = merged;
    } catch {
      // Silently leave existing map — cards fall back to CAA direct / placeholder
    } finally {
      isResolving.value = false;
    }
  }

  function clear() {
    artworkMap.value = {};
  }

  return { artworkMap, clear, getResolved, isResolving, resolve };
}
