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
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const bootstrapStatus = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);
  const isRevalidating = ref(false);

  let destroyed = false;
  let hasLoaded = false;
  let pollTimer = null;
  let visibilityHandler = null;

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

  function clearPollTimer() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll() {
    clearPollTimer();
    if (pollIntervalMs <= 0 || destroyed) {
      return;
    }
    pollTimer = setTimeout(() => {
      if (!destroyed) {
        void revalidate();
      }
    }, pollIntervalMs);
  }

  function destroy() {
    destroyed = true;
    clearPollTimer();
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
  }

  function attachVisibilityListener() {
    if (visibilityHandler) {
      return;
    }
    visibilityHandler = () => {
      if (document.visibilityState === 'visible' && !destroyed) {
        void revalidate();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  async function loadStatus() {
    if (destroyed) return;
    isLoading.value = true;
    errorMessage.value = '';
    try {
      bootstrapStatus.value = await fetchBootstrapStatus();
      if (destroyed) return;
      hasLoaded = true;
    } catch (error) {
      if (destroyed) return;
      bootstrapStatus.value = null;
      errorMessage.value = getErrorMessage(error, 'Bootstrap status failed');
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        schedulePoll();
      }
    }
  }

  async function revalidate() {
    if (destroyed) return;
    const isFirst = !hasLoaded;
    if (isFirst) {
      isLoading.value = true;
    } else {
      isRevalidating.value = true;
    }
    try {
      const result = await fetchBootstrapStatus();
      if (destroyed) return;
      bootstrapStatus.value = result;
      hasLoaded = true;
    } catch {
      if (destroyed) return;
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  return {
    attachVisibilityListener,
    bootstrapStatus,
    destroy,
    errorMessage,
    isLoading,
    isRevalidating,
    loadStatus,
    ownerClaimSummary,
    pathValidationSummary,
    pollIntervalMs,
    revalidate,
    revalidateOnFocus,
  };
}
