/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readonly, ref, toValue, watch } from 'vue';
import { searchExternalRequestAgain } from '../lib/external-request-review-api.js';
import { createRetryIdempotencyKeyStore } from '../lib/retry-idempotency-key-store.js';

export function useExternalRequestSearchRecovery({ mediaRequestId, intentId, recipientId,
  execute = searchExternalRequestAgain, retryKeys = createRetryIdempotencyKeyStore() } = {}) {
  const isPending = ref(false); const statusMessage = ref(''); const errorMessage = ref('');
  const hasUncertainIntent = ref(false);
  let generation = 0; let disposed = false; let savedCommand = null; let actionKey = null;
  const identity = () => [toValue(mediaRequestId), toValue(intentId), toValue(recipientId)];
  function clearIntent() { if (actionKey) retryKeys.clear(actionKey); actionKey = null; savedCommand = null; hasUncertainIntent.value = false; }
  const stopWatch = watch(() => JSON.stringify(identity()), () => {
    generation++; clearIntent(); isPending.value = false; statusMessage.value = ''; errorMessage.value = '';
  }, { flush: 'sync' });

  async function searchAgain({ expectedOperationRunId } = {}) {
    const [requestId, approvedIntentId, targetId] = identity();
    if (disposed || isPending.value || !requestId || !approvedIntentId || !targetId) return null;
    if (!hasUncertainIntent.value) {
      if (!expectedOperationRunId) return null;
      clearIntent();
      savedCommand = { mediaRequestId: requestId, intentId: approvedIntentId, expectedOperationRunId };
      actionKey = JSON.stringify([requestId, approvedIntentId, targetId, expectedOperationRunId]);
    }
    const command = savedCommand; const key = actionKey; const owner = generation;
    const idempotencyKey = retryKeys.getOrCreate({ actionKey: key, scope: 'external-request.search-again' });
    isPending.value = true; errorMessage.value = ''; statusMessage.value = 'Queueing a new search for the approved release…';
    try {
      const result = await execute({ ...command, idempotencyKey });
      const recovery = result?.searchRecovery;
      if (recovery?.outcome !== 'queued' || recovery.mediaRequestId !== command.mediaRequestId || recovery.intentId !== command.intentId
        || recovery.previousOperationRunId !== command.expectedOperationRunId
        || typeof recovery.operationRunId !== 'string' || !recovery.operationRunId || recovery.operationRunId === command.expectedOperationRunId) {
        throw new Error('Search recovery result is unavailable');
      }
      retryKeys.clear(key);
      if (disposed || owner !== generation) return null;
      clearIntent();
      statusMessage.value = recovery.reusedExistingRun ? 'This new search was already queued. Review its current status.'
        : 'A new search is queued for the approved release. Candidates will still need review.';
      return result;
    } catch (error) {
      const definite = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 && error.code !== 'idempotency_key_in_progress';
      if (definite) retryKeys.clear(key);
      if (!disposed && owner === generation) {
        if (definite) clearIntent(); else hasUncertainIntent.value = true;
        statusMessage.value = '';
        errorMessage.value = error?.code === 'external_request_search_cooldown'
          ? 'This approved release is waiting for its search cooldown. Refresh the review to see the next search time.'
          : error?.code === 'external_request_search_exhausted'
            ? 'The fresh-search limit has been reached. Review the approved release and provider health.'
            : error?.status === 409 && definite
          ? 'This approved search changed. Refresh the review before requesting another search.'
          : definite ? 'This search request was refused. Refresh the review and check your access before trying again.'
            : 'The result is uncertain. Retry the saved search request to resolve it safely.';
      }
      return null;
    } finally { if (!disposed && owner === generation) isPending.value = false; }
  }
  function destroy() { disposed = true; generation++; stopWatch(); }
  return { isPending: readonly(isPending), statusMessage: readonly(statusMessage), errorMessage: readonly(errorMessage),
    hasUncertainIntent: readonly(hasUncertainIntent), searchAgain, destroy };
}
