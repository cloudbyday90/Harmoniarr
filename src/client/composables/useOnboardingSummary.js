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
import { fetchOnboardingSummary as defaultFetchOnboardingSummary } from '../lib/system-api.js';

function hasOutstandingIssues(summaryValue) {
  return (summaryValue?.summary?.issueCount ?? 0) > 0;
}

export function useOnboardingSummary({
  fetchOnboardingSummary = defaultFetchOnboardingSummary,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const onboardingSummary = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isRevalidating = ref(false);
  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;

  const nextAction = computed(() => onboardingSummary.value?.nextAction ?? null);
  const steps = computed(() => onboardingSummary.value?.steps ?? []);
  const summary = computed(() => onboardingSummary.value?.summary ?? null);

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
    if (!hasOutstandingIssues(onboardingSummary.value)) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await loadOnboardingSummary();
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    void loadOnboardingSummary().then(() => {
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

  async function loadOnboardingSummary() {
    if (destroyed) return;
    errorMessage.value = '';

    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }

    try {
      onboardingSummary.value = await fetchOnboardingSummary();
      hasLoaded = true;
    } catch (error) {
      if (!isRevalidation) {
        onboardingSummary.value = null;
      }
      errorMessage.value = getErrorMessage(error, 'Onboarding summary failed');
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
    destroy,
    errorMessage,
    isLoading,
    isRevalidating: readonly(isRevalidating),
    loadOnboardingSummary,
    nextAction,
    onboardingSummary,
    steps,
    summary,
  };
}