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
  fetchQueueDiagnostics as defaultFetchQueueDiagnostics,
  fetchRecoveryDiagnostics as defaultFetchRecoveryDiagnostics,
} from '../lib/recovery-api.js';

export function useRecoveryDiagnostics({
  fetchQueueDiagnostics = defaultFetchQueueDiagnostics,
  fetchRecoveryDiagnostics = defaultFetchRecoveryDiagnostics,
} = {}) {
  const errorMessage = ref('');
  const isLoading = ref(true);
  const queueDiagnostics = ref(null);
  const recoveryDiagnostics = ref(null);

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

  return {
    errorMessage,
    isLoading,
    loadDiagnostics,
    queueDiagnostics,
    recentFailedRuns,
    recentPrivilegedActions,
    recentQueueRuns,
    recoveryDiagnostics,
  };
}
