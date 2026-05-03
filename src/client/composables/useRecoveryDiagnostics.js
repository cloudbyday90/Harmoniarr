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

import { computed, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  enterMaintenanceLock as defaultEnterMaintenanceLock,
  fetchQueueDiagnostics as defaultFetchQueueDiagnostics,
  fetchRecoveryDiagnostics as defaultFetchRecoveryDiagnostics,
  releaseMaintenanceLock as defaultReleaseMaintenanceLock,
} from '../lib/recovery-api.js';

export function useRecoveryDiagnostics({
  enterMaintenanceLock = defaultEnterMaintenanceLock,
  fetchQueueDiagnostics = defaultFetchQueueDiagnostics,
  fetchRecoveryDiagnostics = defaultFetchRecoveryDiagnostics,
  releaseMaintenanceLock = defaultReleaseMaintenanceLock,
} = {}) {
  const actionErrorMessage = ref('');
  const errorMessage = ref('');
  const isEnteringLock = ref(false);
  const isLoading = ref(true);
  const releasingLockId = ref(null);
  const queueDiagnostics = ref(null);
  const recoveryDiagnostics = ref(null);

  const activeLocks = computed(() => recoveryDiagnostics.value?.maintenance?.activeLocks ?? []);
  const queueState = computed(() => recoveryDiagnostics.value?.queueState ?? queueDiagnostics.value?.queueState ?? {
    failed: 0,
    pending: 0,
    running: 0,
    totalTracked: 0,
  });
  const recentFailedRuns = computed(() => recoveryDiagnostics.value?.recentFailedRuns ?? []);
  const recentPrivilegedActions = computed(() => recoveryDiagnostics.value?.recentPrivilegedActions ?? []);
  const recentQueueRuns = computed(() => queueDiagnostics.value?.recentRuns ?? []);

  async function loadDiagnostics() {
    isLoading.value = true;
    errorMessage.value = '';

    try {
      const [nextQueueDiagnostics, nextRecoveryDiagnostics] = await Promise.all([
        fetchQueueDiagnostics(),
        fetchRecoveryDiagnostics(),
      ]);

      queueDiagnostics.value = nextQueueDiagnostics;
      recoveryDiagnostics.value = nextRecoveryDiagnostics;
    } catch (error) {
      queueDiagnostics.value = null;
      recoveryDiagnostics.value = null;
      errorMessage.value = getErrorMessage(error, 'Recovery diagnostics failed');
    } finally {
      isLoading.value = false;
    }
  }

  async function createMaintenanceLock(payload) {
    isEnteringLock.value = true;
    actionErrorMessage.value = '';

    try {
      const result = await enterMaintenanceLock(payload);
      await loadDiagnostics();
      return result;
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Entering maintenance lock failed');
      return null;
    } finally {
      isEnteringLock.value = false;
    }
  }

  async function releaseLock(lockId) {
    if (typeof lockId !== 'string' || lockId.trim().length === 0) {
      return null;
    }

    releasingLockId.value = lockId;
    actionErrorMessage.value = '';

    try {
      const result = await releaseMaintenanceLock(lockId);
      await loadDiagnostics();
      return result;
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Releasing maintenance lock failed');
      return null;
    } finally {
      releasingLockId.value = null;
    }
  }

  return {
    actionErrorMessage,
    activeLocks,
    createMaintenanceLock,
    errorMessage,
    isEnteringLock,
    isLoading,
    loadDiagnostics,
    queueDiagnostics,
    queueState,
    recentFailedRuns,
    recentPrivilegedActions,
    recentQueueRuns,
    recoveryDiagnostics,
    releaseLock,
    releasingLockId,
  };
}
