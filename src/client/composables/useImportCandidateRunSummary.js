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

export function useImportCandidateRunSummary({
  fetchSummary = async () => ({}),
  loadErrorMessage,
  secondaryAction = null,
  secondaryActionErrorMessage = 'Action failed',
  startRun = null,
  startRunErrorMessage = 'Start failed',
  summaryKey,
} = {}) {
  const actionErrorMessage = ref('');
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isSecondaryActionPending = ref(false);
  const isStarting = ref(false);
  const runSummary = ref(null);

  const activeRun = computed(() => runSummary.value?.activeRun ?? null);
  const currentRun = computed(() => runSummary.value?.currentRun ?? null);
  const latestRun = computed(() => runSummary.value?.latestRun ?? null);
  const summary = computed(() => runSummary.value?.summary ?? null);

  async function loadRunSummary() {
    isLoading.value = true;
    errorMessage.value = '';

    try {
      runSummary.value = (await fetchSummary())?.[summaryKey] ?? null;
    } catch (error) {
      runSummary.value = null;
      errorMessage.value = getErrorMessage(error, loadErrorMessage);
    } finally {
      isLoading.value = false;
    }
  }

  async function startRunAction() {
    if (typeof startRun !== 'function') {
      return;
    }

    actionErrorMessage.value = '';
    isStarting.value = true;

    try {
      await startRun();
      await loadRunSummary();
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, startRunErrorMessage);
    } finally {
      isStarting.value = false;
    }
  }

  async function runSecondaryAction() {
    if (typeof secondaryAction !== 'function') {
      return;
    }

    actionErrorMessage.value = '';
    isSecondaryActionPending.value = true;

    try {
      await secondaryAction();
      await loadRunSummary();
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, secondaryActionErrorMessage);
    } finally {
      isSecondaryActionPending.value = false;
    }
  }

  return {
    actionErrorMessage,
    activeRun,
    currentRun,
    errorMessage,
    isLoading,
    isSecondaryActionPending,
    isStarting,
    latestRun,
    loadRunSummary,
    runSecondaryAction,
    runSummary,
    startRunAction,
    summary,
  };
}