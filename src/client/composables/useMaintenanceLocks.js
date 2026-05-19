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
  fetchMaintenanceLocks as defaultFetchMaintenanceLocks,
  releaseMaintenanceLock as defaultReleaseMaintenanceLock,
} from '../lib/recovery-api.js';

export function useMaintenanceLocks({
  enterMaintenanceLock = defaultEnterMaintenanceLock,
  fetchMaintenanceLocks = defaultFetchMaintenanceLocks,
  releaseMaintenanceLock = defaultReleaseMaintenanceLock,
} = {}) {
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isEntering = ref(false);
  const isReleasing = ref(false);
  const locks = ref([]);
  const actionError = ref('');

  const hasActiveLocks = computed(() => locks.value.some((l) => {
    if (l.status === 'released') return false;
    if (!l.expiresAt) return true;
    return new Date(l.expiresAt) > new Date();
  }));

  const activeLocks = computed(() => locks.value.filter((l) => {
    if (l.status === 'released') return false;
    if (!l.expiresAt) return true;
    return new Date(l.expiresAt) > new Date();
  }));

  async function loadLocks() {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const payload = await fetchMaintenanceLocks();
      locks.value = payload?.locks ?? [];
    } catch (error) {
      locks.value = [];
      errorMessage.value = getErrorMessage(error, 'Failed to load maintenance locks');
    } finally {
      isLoading.value = false;
    }
  }

  async function enterLock({ lockType, expiresAt, reason }) {
    isEntering.value = true;
    actionError.value = '';
    try {
      await enterMaintenanceLock({ lockType, expiresAt, reason });
      await loadLocks();
      return true;
    } catch (error) {
      actionError.value = getErrorMessage(error, 'Failed to enter maintenance lock');
      return false;
    } finally {
      isEntering.value = false;
    }
  }

  async function releaseLock(lockId) {
    isReleasing.value = true;
    actionError.value = '';
    try {
      await releaseMaintenanceLock(lockId);
      await loadLocks();
      return true;
    } catch (error) {
      actionError.value = getErrorMessage(error, 'Failed to release maintenance lock');
      return false;
    } finally {
      isReleasing.value = false;
    }
  }

  return {
    actionError,
    activeLocks,
    enterLock,
    errorMessage,
    hasActiveLocks,
    isEntering,
    isLoading,
    isReleasing,
    loadLocks,
    locks,
    releaseLock,
  };
}
