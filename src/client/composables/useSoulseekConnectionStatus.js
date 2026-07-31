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

import { readonly, ref } from 'vue';
import { fetchSlskdStatus as defaultFetchSlskdStatus } from '../lib/slskd-search-api.js';

function resolveErrorCode(error) {
  return typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : 'connection_check_failed';
}

/**
 * Loads only the saved Soulseek provider status. It intentionally does not use
 * the broad system-overview endpoint, which can probe unrelated services while
 * an operator is testing one connection.
 */
export function useSoulseekConnectionStatus({
  fetchSlskdStatus = defaultFetchSlskdStatus,
} = {}) {
  const connectionErrorCode = ref('');
  const connectionStatus = ref(null);
  const isLoading = ref(false);

  async function loadConnectionStatus() {
    isLoading.value = true;
    connectionErrorCode.value = '';

    try {
      connectionStatus.value = await fetchSlskdStatus();
      return connectionStatus.value;
    } catch (error) {
      connectionStatus.value = null;
      connectionErrorCode.value = resolveErrorCode(error);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    connectionErrorCode: readonly(connectionErrorCode),
    connectionStatus: readonly(connectionStatus),
    isLoading: readonly(isLoading),
    loadConnectionStatus,
  };
}
