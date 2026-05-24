import { ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  bulkReviewImportCandidates as defaultBulkReviewImportCandidates,
} from '../lib/import-candidate-api.js';

export function useImportCandidateBulkReview({
  bulkReviewImportCandidates = defaultBulkReviewImportCandidates,
} = {}) {
  const errorMessage = ref('');
  const isExecuting = ref(false);
  const lastResult = ref(null);

  async function execute({ action, importCandidateIds, reason } = {}) {
    if (!Array.isArray(importCandidateIds) || importCandidateIds.length === 0) {
      return null;
    }

    isExecuting.value = true;
    errorMessage.value = '';

    try {
      const payload = await bulkReviewImportCandidates({
        action,
        importCandidateIds,
        reason,
      });
      lastResult.value = payload;
      return payload;
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Failed to apply bulk review operation');
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
