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

import { ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  bulkCancelMediaRequests as defaultBulkCancelMediaRequests,
} from '../lib/media-request-api.js';

export function useMediaRequestBulkCancel({
  bulkCancelMediaRequests = defaultBulkCancelMediaRequests,
} = {}) {
  const errorMessage = ref('');
  const isExecuting = ref(false);
  const lastResult = ref(null);

  async function execute({ mediaRequestIds, reason } = {}) {
    if (!Array.isArray(mediaRequestIds) || mediaRequestIds.length === 0) {
      return null;
    }

    isExecuting.value = true;
    errorMessage.value = '';

    try {
      const payload = await bulkCancelMediaRequests({
        mediaRequestIds,
        reason,
      });
      lastResult.value = payload;
      return payload;
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Failed to cancel media requests');
      return null;
    } finally {
      isExecuting.value = false;
    }
  }

  function reset() {
    errorMessage.value = '';
    isExecuting.value = false;
    lastResult.value = null;
  }

  return {
    errorMessage,
    execute,
    isExecuting,
    lastResult,
    reset,
  };
}
