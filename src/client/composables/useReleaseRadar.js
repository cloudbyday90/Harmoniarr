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

import { computed, readonly, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import { fetchReleaseRadar as defaultFetchReleaseRadar } from '../lib/library-api.js';
import { normalizeRadarReleaseForCard } from '../lib/release-radar-normalization.js';

export function useReleaseRadar({
  fetchRadarFn = defaultFetchReleaseRadar,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const recent = ref([]);
  const upcoming = ref([]);
  const checkedAt = ref(null);
  const windows = ref({ recentDays: 30, upcomingDays: 90 });
  const isLoading = ref(false);
  const isRevalidating = ref(false);
  const errorMessage = ref('');
  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;

  const hasRecent = computed(() => recent.value.length > 0);
  const hasUpcoming = computed(() => upcoming.value.length > 0);
  const isEmpty = computed(() => !hasRecent.value && !hasUpcoming.value);

  function clearPollTimer() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll() {
    clearPollTimer();
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    if (destroyed) return;
    if (isEmpty.value) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await load();
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    void load().then(() => {
      if (!destroyed) schedulePoll();
    });
  }

  function destroy() {
    destroyed = true;
    clearPollTimer();
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  function attachVisibilityListener() {
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  async function load({ signal } = {}) {
    if (destroyed) return;
    errorMessage.value = '';

    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }

    try {
      const payload = await fetchRadarFn({ signal });
      recent.value = Array.isArray(payload?.recent)
        ? payload.recent.map(normalizeRadarReleaseForCard)
        : [];
      upcoming.value = Array.isArray(payload?.upcoming)
        ? payload.upcoming.map(normalizeRadarReleaseForCard)
        : [];
      checkedAt.value = payload?.checkedAt ?? null;
      windows.value = payload?.windows ?? { recentDays: 30, upcomingDays: 90 };
      hasLoaded = true;
    } catch (error) {
      if (!isRevalidation) {
        recent.value = [];
        upcoming.value = [];
        checkedAt.value = null;
      }
      errorMessage.value = getErrorMessage(error, 'Could not load release radar.');
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  return {
    attachVisibilityListener,
    checkedAt,
    destroy,
    errorMessage,
    hasRecent,
    hasUpcoming,
    isEmpty,
    isLoading,
    isRevalidating: readonly(isRevalidating),
    load,
    recent,
    upcoming,
    windows,
  };
}
