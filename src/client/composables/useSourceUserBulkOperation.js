import { ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  bulkBlockActivitySourceUsers as defaultBulkBlockActivitySourceUsers,
  bulkUpdateActivitySourceUserTrust as defaultBulkUpdateActivitySourceUserTrust,
} from '../lib/activity-api.js';

export function useSourceUserBulkOperation({
  bulkBlockActivitySourceUsers = defaultBulkBlockActivitySourceUsers,
  bulkUpdateActivitySourceUserTrust = defaultBulkUpdateActivitySourceUserTrust,
} = {}) {
  const errorMessage = ref('');
  const isExecuting = ref(false);
  const lastResult = ref(null);

  async function executeBulkTrust({ operatorNotes, reason, trustState, usernames }) {
    if (!Array.isArray(usernames) || usernames.length === 0) {
      return null;
    }

    isExecuting.value = true;
    errorMessage.value = '';

    try {
      const payload = await bulkUpdateActivitySourceUserTrust({
        operatorNotes,
        reason,
        trustState,
        usernames,
      });
      lastResult.value = payload;
      return payload;
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Failed to apply bulk trust operation');
      return null;
    } finally {
      isExecuting.value = false;
    }
  }

  async function executeBulkBlock({ operatorNotes, reason, usernames }) {
    if (!Array.isArray(usernames) || usernames.length === 0) {
      return null;
    }

    isExecuting.value = true;
    errorMessage.value = '';

    try {
      const payload = await bulkBlockActivitySourceUsers({
        operatorNotes,
        reason,
        usernames,
      });
      lastResult.value = payload;
      return payload;
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Failed to apply bulk block operation');
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
    executeBulkBlock,
    executeBulkTrust,
    isExecuting,
    lastResult,
    reset,
  };
}
