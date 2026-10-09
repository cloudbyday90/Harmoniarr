/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readonly, ref, toValue, watch } from 'vue';
import { adoptImportCandidateDownloads, fetchImportCandidateDownloadAdoptionReview } from '../lib/import-candidate-api.js';
import { buildImportCandidateDownloadAdoptionPresentation } from '../lib/import-candidate-download-adoption-presentation.js';
import { createRetryIdempotencyKeyStore } from '../lib/retry-idempotency-key-store.js';

function fixedError(error, fallback) {
  if (error?.code === 'idempotency_key_in_progress') return 'The saved choice is still being processed. Try the same choice again shortly.';
  if (error?.status === 401 || error?.code === 'reauth_required') return 'Sign in again before reviewing this download request.';
  if (error?.status === 403) return 'Only an administrator can review this download request.';
  if (error?.status === 404) return 'This download request is unavailable.';
  if (error?.status === 409) return 'This request changed. Review its current evidence before continuing.';
  if (error?.status === 429) return 'Too many review requests were made. Wait a moment and try again.';
  return fallback;
}

export function useImportCandidateDownloadAdoption({ operationRunId, importCandidateId,
  fetchReview = fetchImportCandidateDownloadAdoptionReview, adoptDownloads = adoptImportCandidateDownloads,
  retryKeyStore = createRetryIdempotencyKeyStore() } = {}) {
  const review = ref(null); const isLoading = ref(false); const isPending = ref(false);
  const errorMessage = ref(''); const statusMessage = ref(''); const hasUncertainIntent = ref(false);
  let generation = 0; let disposed = false; let controller = null; let actionKey = null; let loadPromise = null;
  const identity = () => ({ operationRunId: String(toValue(operationRunId) ?? '').trim(), importCandidateId: String(toValue(importCandidateId) ?? '').trim() });
  function clearIntent() { if (actionKey) retryKeyStore.clear(actionKey); actionKey = null; hasUncertainIntent.value = false; }
  function reset() { generation += 1; controller?.abort(); controller = null; loadPromise = null;
    review.value = null; isLoading.value = false; isPending.value = false; errorMessage.value = ''; statusMessage.value = ''; clearIntent(); }
  const stopWatch = watch(() => `${identity().operationRunId}\u0000${identity().importCandidateId}`, reset, { flush: 'sync' });
  async function loadReview() {
    if (disposed || isPending.value) return null;
    if (hasUncertainIntent.value && review.value) return review.value;
    if (loadPromise) return loadPromise;
    const owner = identity(); if (!owner.operationRunId || !owner.importCandidateId) return null;
    const current = generation; controller = new AbortController(); isLoading.value = true;
    review.value = null; errorMessage.value = ''; statusMessage.value = ''; clearIntent();
    loadPromise = (async () => {
      try {
        const payload = await fetchReview({ ...owner, signal: controller.signal });
        if (disposed || current !== generation) return null;
        const nextReview = payload?.downloadAdoptionReview;
        if (!nextReview || nextReview.operationRunId !== owner.operationRunId || nextReview.importCandidateId !== owner.importCandidateId) {
          throw new Error('Review scope is unavailable');
        }
        review.value = nextReview;
        return review.value;
      } catch (error) {
        if (!disposed && current === generation && error?.name !== 'AbortError' && error?.code !== 'request_aborted') {
          errorMessage.value = fixedError(error, 'Download evidence could not be checked. Try reviewing this request again.');
        }
        return null;
      } finally { if (!disposed && current === generation) { isLoading.value = false; loadPromise = null; controller = null; } }
    })();
    return loadPromise;
  }
  async function adopt() {
    const presentation = buildImportCandidateDownloadAdoptionPresentation(review.value);
    if (disposed || isPending.value || !presentation.canAdopt) return null;
    const owner = identity(); const current = generation;
    const nextKey = JSON.stringify([owner.operationRunId, owner.importCandidateId, presentation.reviewDigest, presentation.transferIds]);
    if (actionKey !== nextKey) clearIntent(); actionKey = nextKey;
    const key = retryKeyStore.getOrCreate({ actionKey, scope: 'import-candidates.execution-handoffs.adopt' });
    isPending.value = true; errorMessage.value = ''; statusMessage.value = 'Linking the reviewed existing downloads…';
    try {
      const result = await adoptDownloads({ ...owner, reviewDigest: presentation.reviewDigest, transferIds: presentation.transferIds, idempotencyKey: key });
      const action = result?.downloadAdoption;
      if (action?.outcome !== 'adopted' || action.operationRunId !== owner.operationRunId || action.importCandidateId !== owner.importCandidateId
        || action.adoptedFileCount !== presentation.requestedFileCount) throw new Error('Download adoption response is unavailable');
      retryKeyStore.clear(nextKey);
      if (disposed || current !== generation) return null;
      hasUncertainIntent.value = false; review.value = null;
      statusMessage.value = result?.downloadAdoption?.replayed ? 'The existing downloads were already linked by the saved choice.'
        : 'The existing downloads are linked. Harmoniarr will continue monitoring them using the saved policy.';
      return result;
    } catch (error) {
      const uncertain = !(Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 && error.code !== 'idempotency_key_in_progress');
      if (!uncertain) retryKeyStore.clear(nextKey);
      if (!disposed && current === generation) {
        hasUncertainIntent.value = uncertain; if (!uncertain) review.value = null;
        statusMessage.value = ''; errorMessage.value = fixedError(error, 'The downloads could not be linked. Review this request before trying again.');
      }
      return null;
    } finally { if (!disposed && current === generation) isPending.value = false; }
  }
  function destroy() { disposed = true; generation += 1; controller?.abort(); stopWatch(); }
  return { review: readonly(review), isLoading: readonly(isLoading), isPending: readonly(isPending), errorMessage: readonly(errorMessage),
    statusMessage: readonly(statusMessage), hasUncertainIntent: readonly(hasUncertainIntent), loadReview, adopt, destroy };
}
