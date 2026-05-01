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
import { fetchOnboardingSummary as defaultFetchOnboardingSummary } from '../lib/system-api.js';

export function useOnboardingSummary({
  fetchOnboardingSummary = defaultFetchOnboardingSummary,
} = {}) {
  const onboardingSummary = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);

  const nextAction = computed(() => onboardingSummary.value?.nextAction ?? null);
  const steps = computed(() => onboardingSummary.value?.steps ?? []);
  const summary = computed(() => onboardingSummary.value?.summary ?? null);

  async function loadOnboardingSummary() {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      onboardingSummary.value = await fetchOnboardingSummary();
    } catch (error) {
      onboardingSummary.value = null;
      errorMessage.value = getErrorMessage(error, 'Onboarding summary failed');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    errorMessage,
    isLoading,
    loadOnboardingSummary,
    nextAction,
    onboardingSummary,
    steps,
    summary,
  };
}