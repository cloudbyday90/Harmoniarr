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
