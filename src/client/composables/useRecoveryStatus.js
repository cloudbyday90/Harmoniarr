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

import { computed, readonly, ref, shallowRef } from 'vue';
import { fetchRecoveryStatus as defaultFetchRecoveryStatus, completeRecovery as defaultCompleteRecovery } from '../lib/recovery-api.js';
import { getErrorMessage } from '../lib/error-utils.js';

const DEFAULT_POLL_INTERVAL_MS = 10_000;

export function useRecoveryStatus({
  fetchRecoveryStatus = defaultFetchRecoveryStatus,
  completeRecovery = defaultCompleteRecovery,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  revalidateOnFocus = false,
} = {}) {
  const status = shallowRef(null);
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isRevalidating = ref(false);
  const isSubmitting = ref(false);
  const completionResult = shallowRef(null);
  const isCompleted = ref(false);

  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;

  const recoveryAvailable = computed(() => status.value?.recoveryAvailable === true);
  const blockedByLock = computed(() => status.value?.blockedByLock === true);
  const remainingAttempts = computed(() => status.value?.remainingAttempts ?? 0);
  const expiresAt = computed(() => status.value?.expiresAt ?? null);

  const secondsRemaining = computed(() => {
    if (!expiresAt.value) {
      return 0;
    }

    const remaining = Math.floor((new Date(expiresAt.value).getTime() - Date.now()) / 1000);
    return Math.max(0, remaining);
  });

  const expired = computed(() => secondsRemaining.value <= 0 && recoveryAvailable.value);

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
    if (!hasLoaded) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await revalidate();
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    void revalidate().then(() => {
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

  async function loadStatus() {
    if (destroyed) return;
    isLoading.value = true;
    errorMessage.value = '';
    try {
      status.value = await fetchRecoveryStatus();
      hasLoaded = true;
    } catch (error) {
      status.value = null;
      errorMessage.value = getErrorMessage(error, 'Failed to load recovery status');
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        schedulePoll();
      }
    }
  }

  async function revalidate() {
    if (destroyed) return;
    isRevalidating.value = true;
    try {
      status.value = await fetchRecoveryStatus();
    } catch {
      // Preserve stale data on revalidation error.
    } finally {
      if (!destroyed) {
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  async function submitRecovery(form) {
    errorMessage.value = '';
    isSubmitting.value = true;
    try {
      const result = await completeRecovery(form);
      completionResult.value = result;
      isCompleted.value = true;
      clearPollTimer();
      return result;
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Recovery failed');
      throw error;
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
    attachVisibilityListener,
    blockedByLock,
    completionResult,
    destroy,
    errorMessage,
    expired,
    expiresAt,
    isCompleted,
    isLoading,
    isRevalidating: readonly(isRevalidating),
    isSubmitting,
    loadStatus,
    recoveryAvailable,
    remainingAttempts,
    revalidate,
    secondsRemaining,
    status,
    submitRecovery,
  };
}
