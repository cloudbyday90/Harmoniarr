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
import { fetchBootstrapStatus as defaultFetchBootstrapStatus } from '../lib/auth-api.js';
import { getErrorMessage } from '../lib/error-utils.js';

export function useBootstrapStatus({
  fetchBootstrapStatus = defaultFetchBootstrapStatus,
} = {}) {
  const bootstrapStatus = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);

  const pathValidationSummary = computed(() => {
    if (!bootstrapStatus.value?.pathValidation) {
      return null;
    }

    return {
      checkedAt: bootstrapStatus.value.pathValidation.checkedAt ?? null,
      configuredDownloadMappings: bootstrapStatus.value.pathValidation.configuredDownloadMappings ?? 0,
      message: bootstrapStatus.value.pathValidation.summary?.message ?? '',
      status: bootstrapStatus.value.pathValidation.summary?.status ?? 'unavailable',
    };
  });

  const ownerClaimSummary = computed(() => {
    const ownerClaim = bootstrapStatus.value?.ownerClaim;
    if (!ownerClaim) {
      return null;
    }

    return {
      authMethods: Array.isArray(ownerClaim.authMethods) ? ownerClaim.authMethods : [],
      emailHint: ownerClaim.emailHint ?? null,
      emailRequired: Boolean(ownerClaim.emailRequired),
      required: Boolean(ownerClaim.required),
      usernameHint: ownerClaim.usernameHint ?? null,
    };
  });

  async function loadStatus() {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      bootstrapStatus.value = await fetchBootstrapStatus();
    } catch (error) {
      bootstrapStatus.value = null;
      errorMessage.value = getErrorMessage(error, 'Bootstrap status failed');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    bootstrapStatus,
    errorMessage,
    isLoading,
    loadStatus,
    ownerClaimSummary,
    pathValidationSummary,
  };
}
