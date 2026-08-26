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
import { fetchMissingMusicDownloaderHandoff as defaultFetchMissingMusicDownloaderHandoff } from '../lib/missing-music-api.js';
import { getErrorMessage } from '../lib/error-utils.js';

function normalizeText(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeHandoff(payload) {
  const decisionId = normalizeText(payload?.decisionId);
  const wantedReleaseId = normalizeText(payload?.wantedReleaseId);
  if (!decisionId || !wantedReleaseId) return null;

  return {
    decisionId,
    release: {
      artistName: normalizeText(payload?.release?.artistName),
      title: normalizeText(payload?.release?.title),
    },
    requestedFor: {
      username: normalizeText(payload?.requestedFor?.username),
    },
    wantedReleaseId,
  };
}

function normalizeDecisionId(value) {
  return normalizeText(value);
}

export function isMissingMusicDownloaderHandoffUnavailableError(error) {
  return (
    error?.status === 404 && error?.code === 'missing_music_decision_not_found'
  ) || (
    error?.status === 409 && error?.code === 'missing_music_downloader_unavailable'
  );
}

/**
 * Resolves an opaque Missing Music decision after navigation. A sequence guard
 * prevents a slow, earlier route read from changing the current release
 * filter; no broad Downloader filter is applied before the handoff resolves.
 */
export function useMissingMusicDownloaderHandoff({
  decisionId = null,
  fetchMissingMusicDownloaderHandoff = defaultFetchMissingMusicDownloaderHandoff,
} = {}) {
  const handoff = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(false);
  const isUnavailable = ref(false);
  const resolvedDecisionId = computed(() => normalizeDecisionId(toValue(decisionId)));
  let disposed = false;
  let requestSequence = 0;

  async function load() {
    const requestId = ++requestSequence;
    const currentDecisionId = resolvedDecisionId.value;
    handoff.value = null;
    errorMessage.value = '';
    isUnavailable.value = false;

    if (!currentDecisionId) {
      isLoading.value = false;
      return null;
    }

    isLoading.value = true;
    try {
      const payload = await fetchMissingMusicDownloaderHandoff(currentDecisionId);
      if (disposed || requestId !== requestSequence) return null;

      const normalizedHandoff = normalizeHandoff(payload);
      if (!normalizedHandoff) {
        throw new Error('Missing Music download context failed to load');
      }

      handoff.value = normalizedHandoff;
      return normalizedHandoff;
    } catch (error) {
      if (disposed || requestId !== requestSequence) return null;

      if (isMissingMusicDownloaderHandoffUnavailableError(error)) {
        isUnavailable.value = true;
        return null;
      }

      errorMessage.value = getErrorMessage(error, 'Missing Music download context failed to load');
      return null;
    } finally {
      if (!disposed && requestId === requestSequence) {
        isLoading.value = false;
      }
    }
  }

  watch(resolvedDecisionId, () => {
    void load();
  }, { immediate: true });

  onBeforeUnmount(() => {
    disposed = true;
    requestSequence += 1;
  });

  return {
    errorMessage,
    handoff,
    isLoading,
    isUnavailable,
    load,
  };
}
