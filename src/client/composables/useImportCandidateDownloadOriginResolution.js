/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { readonly, ref, toValue, watch } from 'vue';
import { fetchImportCandidateDownloadOriginReview, resolveImportCandidateDownloadOrigin } from '../lib/import-candidate-api.js';
import { buildImportCandidateDownloadOriginPresentation } from '../lib/import-candidate-download-origin-presentation.js';
import { createRetryIdempotencyKeyStore } from '../lib/retry-idempotency-key-store.js';

function publicError(error, fallback) {
  if (error?.code === 'idempotency_key_in_progress') return 'The saved choice is still being processed. Try the same choice again shortly.';
  if (error?.status === 401 || error?.code === 'reauth_required') return 'Sign in again before resolving this download request.';
  if (error?.status === 403) return 'Only an administrator can resolve this download request.';
  if (error?.status === 404) return 'This download request is unavailable.';
  if (error?.status === 409) return 'This request changed. Review its current evidence before continuing.';
  if (error?.status === 429) return 'Too many review requests were made. Wait a moment and try again.';
  return fallback;
}

export function useImportCandidateDownloadOriginResolution({ operationRunId, importCandidateId,
  fetchReview = fetchImportCandidateDownloadOriginReview, resolveOrigin = resolveImportCandidateDownloadOrigin,
  retryKeyStore = createRetryIdempotencyKeyStore() } = {}) {
  const review = ref(null); const isLoading = ref(false); const isPending = ref(false);
  const errorMessage = ref(''); const statusMessage = ref(''); const hasUncertainIntent = ref(false);
  let generation = 0; let disposed = false; let controller = null; let actionKey = null; let readPromise = null;
  const identity = () => ({ operationRunId: String(toValue(operationRunId) ?? '').trim(), importCandidateId: String(toValue(importCandidateId) ?? '').trim() });
  function clearIntent() { if (actionKey) retryKeyStore.clear(actionKey); actionKey = null; hasUncertainIntent.value = false; }
  function reset() {
    generation += 1; controller?.abort(); controller = null; readPromise = null;
    review.value = null; isLoading.value = false; isPending.value = false; errorMessage.value = ''; statusMessage.value = ''; clearIntent();
  }
  const stopWatch = watch(() => `${identity().operationRunId}\u0000${identity().importCandidateId}`, reset, { flush: 'sync' });
  async function loadReview() {
    if (disposed || isPending.value) return null;
    if (hasUncertainIntent.value && review.value) return review.value;
    if (readPromise) return readPromise;
    const owner = identity(); if (!owner.operationRunId || !owner.importCandidateId) return null;
    const current = generation; controller = new AbortController(); isLoading.value = true;
    review.value = null; errorMessage.value = ''; statusMessage.value = ''; clearIntent();
    readPromise = (async () => {
      try {
        const payload = await fetchReview({ ...owner, signal: controller.signal });
        if (disposed || current !== generation) return null;
        const next = payload?.downloadOriginReview;
        if (!next || next.operationRunId !== owner.operationRunId || next.importCandidateId !== owner.importCandidateId) throw new Error('Review scope is unavailable');
        review.value = next; return next;
      } catch (error) {
        if (!disposed && current === generation && error?.name !== 'AbortError' && error?.code !== 'request_aborted') {
          errorMessage.value = publicError(error, 'This download request could not be checked. Try reviewing it again.');
        }
        return null;
      } finally { if (!disposed && current === generation) { isLoading.value = false; readPromise = null; controller = null; } }
    })();
    return readPromise;
  }
  async function restore() {
    const facts = buildImportCandidateDownloadOriginPresentation(review.value);
    if (disposed || isPending.value || !facts.canRestore) return null;
    const owner = identity(); const current = generation;
    const nextKey = JSON.stringify(['download-origin-resolution', owner.operationRunId, owner.importCandidateId, facts.reviewDigest, facts.verifiedFileCount, facts.retiredRequestCount]);
    if (actionKey !== nextKey) clearIntent(); actionKey = nextKey;
    const key = retryKeyStore.getOrCreate({ actionKey, scope: 'import-candidates.download-origin-resolution' });
    isPending.value = true; errorMessage.value = ''; statusMessage.value = 'Resolving the reviewed download request…';
    try {
      const result = await resolveOrigin({ ...owner, reviewDigest: facts.reviewDigest, idempotencyKey: key });
      const action = result?.downloadOriginResolution;
      if (action?.outcome !== 'restored' || action.operationRunId !== owner.operationRunId || action.importCandidateId !== owner.importCandidateId
        || action.verifiedFileCount !== facts.verifiedFileCount || action.retiredRequestCount !== facts.retiredRequestCount) throw new Error('Resolution response is unavailable');
      retryKeyStore.clear(nextKey);
      if (disposed || current !== generation) return null;
      hasUncertainIntent.value = false; review.value = null;
      statusMessage.value = action.replayed === true ? 'The unused newer request was already stopped by this saved choice. Harmoniarr can track the verified existing downloads.'
        : 'The unused newer request was stopped. Harmoniarr can track the verified existing downloads.';
      return result;
    } catch (error) {
      const uncertain = !(Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 && error.code !== 'idempotency_key_in_progress');
      if (!uncertain) retryKeyStore.clear(nextKey);
      if (!disposed && current === generation) {
        hasUncertainIntent.value = uncertain; if (!uncertain) review.value = null;
        statusMessage.value = ''; errorMessage.value = publicError(error, 'This download request could not be resolved. Review it before trying again.');
      }
      return null;
    } finally { if (!disposed && current === generation) isPending.value = false; }
  }
  function destroy() { disposed = true; generation += 1; controller?.abort(); stopWatch(); }
  return { review: readonly(review), isLoading: readonly(isLoading), isPending: readonly(isPending), errorMessage: readonly(errorMessage),
    statusMessage: readonly(statusMessage), hasUncertainIntent: readonly(hasUncertainIntent), loadReview, restore, destroy };
}
