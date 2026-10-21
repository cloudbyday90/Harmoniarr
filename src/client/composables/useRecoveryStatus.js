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

import { computed, nextTick, readonly, ref, shallowRef } from 'vue';
import { fetchRecoveryStatus as defaultFetchRecoveryStatus, completeRecovery as defaultCompleteRecovery } from '../lib/recovery-api.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { useExpiryCountdown } from './useExpiryCountdown.js';

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
  let readRevision = 0;
  let visibilityAttached = false;

  const recoveryAvailable = computed(() => status.value?.recoveryAvailable === true);
  const blockedByLock = computed(() => status.value?.blockedByLock === true);
  const remainingAttempts = computed(() => status.value?.remainingAttempts ?? 0);
  const expiresAt = computed(() => status.value?.expiresAt ?? null);

  const countdown = useExpiryCountdown({
    getExpiresAt: () => expiresAt.value,
    isActive: () => recoveryAvailable.value && !isCompleted.value
      && (typeof document === 'undefined' || !document.hidden),
  });
  const { secondsRemaining } = countdown;

  const expired = computed(() => secondsRemaining.value <= 0 && recoveryAvailable.value);
  const canSubmit = computed(() => !isLoading.value && !isSubmitting.value && !isCompleted.value
    && recoveryAvailable.value && !expired.value && !blockedByLock.value && remainingAttempts.value > 0);

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
    if (isSubmitting.value || isCompleted.value) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await revalidate();
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (destroyed) return;
    countdown.refresh();
    if (typeof document === 'undefined' || document.hidden || !hasLoaded) return;
    void revalidate().then(() => {
      if (!destroyed) schedulePoll();
    });
  }

  function destroy() {
    destroyed = true;
    readRevision++;
    clearPollTimer();
    countdown.destroy();
    if (visibilityAttached && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      visibilityAttached = false;
    }
  }

  function attachVisibilityListener() {
    if (!destroyed && !visibilityAttached && revalidateOnFocus && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      visibilityAttached = true;
    }
  }

  async function readStatus(initial, { duringSubmission = false } = {}) {
    if (destroyed || isCompleted.value || (isSubmitting.value && !duringSubmission)) return;
    const revision = ++readRevision;
    if (initial) { isLoading.value = true; errorMessage.value = ''; }
    else isRevalidating.value = true;
    const current = () => !destroyed && !isCompleted.value && revision === readRevision;
    try {
      const result = await fetchRecoveryStatus();
      if (current()) { status.value = result; hasLoaded = true; }
    } catch (error) {
      if (initial && current()) {
        status.value = null;
        errorMessage.value = getErrorMessage(error, 'Failed to load recovery status');
      }
      // A failed background refresh preserves both prior status and POST error.
    } finally {
      if (current()) {
        isLoading.value = false; isRevalidating.value = false;
        countdown.refresh();
        schedulePoll();
      }
    }
  }

  const loadStatus = () => readStatus(true);
  const revalidate = () => readStatus(false);

  async function submitRecovery(form) {
    if (destroyed) return null;
    // Recheck wall time even if the browser has suspended the display timer.
    countdown.refresh();
    if (!canSubmit.value) return null;
    readRevision++; clearPollTimer(); isRevalidating.value = false;
    errorMessage.value = '';
    isSubmitting.value = true;
    try {
      await nextTick();
      if (destroyed) return null;
      countdown.refresh();
      if (expired.value) return null;
      const result = await completeRecovery(form);
      if (!destroyed) { completionResult.value = result; isCompleted.value = true; countdown.refresh(); }
      return result;
    } catch (error) {
      if (!destroyed) {
        errorMessage.value = getErrorMessage(error, 'Recovery failed');
        await readStatus(false, { duringSubmission: true });
      }
      throw error;
    } finally {
      if (!destroyed) { isSubmitting.value = false; schedulePoll(); }
    }
  }

  return {
    attachVisibilityListener,
    blockedByLock,
    canSubmit,
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
