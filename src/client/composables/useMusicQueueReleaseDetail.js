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

import { computed, onBeforeUnmount, ref, toValue, watch } from 'vue';
import { fetchMusicQueueRelease as defaultFetchMusicQueueRelease } from '../lib/acquisition-api.js';
import { normalizeMusicQueueRelease } from '../lib/acquisition-pipeline-presentation.js';
import { getErrorMessage } from '../lib/error-utils.js';

function normalizeWantedReleaseId(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function isMusicQueueReleaseNotFoundError(error) {
  return error?.status === 404 && error?.code === 'music_queue_release_not_found';
}

/**
 * Loads the selected Music Queue release through its scoped detail endpoint.
 * The list remains useful for queue context, but a deep link must be resolved
 * by the server so it cannot inherit another operator's projected release.
 */
export function useMusicQueueReleaseDetail({
  fetchMusicQueueRelease = defaultFetchMusicQueueRelease,
  immediate = true,
  wantedReleaseId = null,
} = {}) {
  const release = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(false);
  const isNotFound = ref(false);
  const resolvedWantedReleaseId = computed(() => normalizeWantedReleaseId(toValue(wantedReleaseId)));
  let disposed = false;
  let requestSequence = 0;

  function applyRelease(payloadRelease, { invalidatePending = true } = {}) {
    const normalizedRelease = normalizeMusicQueueRelease(payloadRelease);
    if (!normalizedRelease) {
      return null;
    }

    if (invalidatePending) {
      requestSequence += 1;
      isLoading.value = false;
    }

    release.value = normalizedRelease;
    errorMessage.value = '';
    isNotFound.value = false;
    return normalizedRelease;
  }

  async function load() {
    const requestId = ++requestSequence;
    const currentWantedReleaseId = resolvedWantedReleaseId.value;

    release.value = null;
    errorMessage.value = '';
    isNotFound.value = false;

    if (!currentWantedReleaseId) {
      isLoading.value = false;
      return null;
    }

    isLoading.value = true;

    try {
      const payload = await fetchMusicQueueRelease(currentWantedReleaseId);
      if (disposed || requestId !== requestSequence) return null;

      if (!payload?.release || typeof payload.release !== 'object') {
        throw new Error('Music Queue release failed to load');
      }

      return applyRelease(payload.release, { invalidatePending: false });
    } catch (error) {
      if (disposed || requestId !== requestSequence) return null;

      if (isMusicQueueReleaseNotFoundError(error)) {
        isNotFound.value = true;
        return null;
      }

      errorMessage.value = getErrorMessage(error, 'Music Queue release failed to load');
      return null;
    } finally {
      if (!disposed && requestId === requestSequence) {
        isLoading.value = false;
      }
    }
  }

  watch(resolvedWantedReleaseId, () => {
    void load();
  }, { immediate });

  onBeforeUnmount(() => {
    disposed = true;
    requestSequence += 1;
  });

  return {
    errorMessage,
    isLoading,
    isNotFound,
    applyRelease,
    load,
    release,
  };
}
