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

export function useImportCandidateStageSummary({
  candidatesKey,
  createEmptyCounts,
  fallbackMessage,
  fetchSummary,
  payloadKey,
} = {}) {
  const stageSummary = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);

  const counts = computed(() => stageSummary.value?.counts ?? createEmptyCounts());
  const candidates = computed(() => stageSummary.value?.[candidatesKey] ?? []);
  const summary = computed(() => stageSummary.value?.summary ?? null);

  async function loadSummary() {
    errorMessage.value = '';
    isLoading.value = true;

    try {
      stageSummary.value = (await fetchSummary())?.[payloadKey] ?? null;
      return stageSummary.value;
    } catch (error) {
      stageSummary.value = null;
      errorMessage.value = getErrorMessage(error, fallbackMessage);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    candidates,
    counts,
    errorMessage,
    isLoading,
    loadSummary,
    stageSummary,
    summary,
  };
}