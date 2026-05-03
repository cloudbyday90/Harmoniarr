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

import { computed, ref, shallowRef } from 'vue';
import { fetchRecoveryStatus as defaultFetchRecoveryStatus, completeRecovery as defaultCompleteRecovery } from '../lib/recovery-api.js';
import { getErrorMessage } from '../lib/error-utils.js';

const POLL_INTERVAL_MS = 10_000;

export function useRecoveryStatus({
  fetchRecoveryStatus = defaultFetchRecoveryStatus,
  completeRecovery = defaultCompleteRecovery,
} = {}) {
  const status = shallowRef(null);
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isSubmitting = ref(false);
  const completionResult = shallowRef(null);
  const isCompleted = ref(false);
  let pollTimer = null;

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

  async function loadStatus() {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      status.value = await fetchRecoveryStatus();
    } catch (error) {
      status.value = null;
      errorMessage.value = getErrorMessage(error, 'Failed to load recovery status');
    } finally {
      isLoading.value = false;
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
      void loadStatus();
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function submitRecovery(form) {
    errorMessage.value = '';
    isSubmitting.value = true;
    try {
      const result = await completeRecovery(form);
      completionResult.value = result;
      isCompleted.value = true;
      stopPolling();
      return result;
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Recovery failed');
      throw error;
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
    blockedByLock,
    completionResult,
    errorMessage,
    expired,
    expiresAt,
    isCompleted,
    isLoading,
    isSubmitting,
    loadStatus,
    recoveryAvailable,
    remainingAttempts,
    secondsRemaining,
    startPolling,
    status,
    stopPolling,
    submitRecovery,
  };
}
