/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { readonly, ref, toValue, watch } from 'vue';
import { fetchMissingMusicDownloadReviewHandoff } from '../lib/missing-music-api.js';
import { buildImportReviewRouteQuery } from '../lib/import-review-route-state.js';

export function buildMissingMusicDownloadReviewLocation(context) {
  if (typeof context?.operationRunId !== 'string' || !context.operationRunId.trim()
    || typeof context.importCandidateId !== 'string' || !context.importCandidateId.trim()) return null;
  return { name: 'activity-diagnostics-matches', hash: '#import-execution-run-panel',
    query: buildImportReviewRouteQuery({ executionRunId: context.operationRunId, candidateId: context.importCandidateId, status: 'selected' }) };
}

export function useMissingMusicDownloadReviewHandoff({ decisionId, fetchContext = fetchMissingMusicDownloadReviewHandoff } = {}) {
  const isLoading = ref(false); const errorMessage = ref(''); let generation = 0; let disposed = false; let controller = null; let promise = null;
  const id = () => String(toValue(decisionId) ?? '').trim();
  function reset() { generation += 1; controller?.abort(); controller = null; promise = null; isLoading.value = false; errorMessage.value = ''; }
  const stopWatch = watch(id, reset, { flush: 'sync' });
  async function loadLocation() {
    if (disposed || !id()) return null;
    if (promise) return promise;
    const current = generation; const selectedId = id(); controller = new AbortController(); isLoading.value = true; errorMessage.value = '';
    promise = (async () => {
      try {
        const context = await fetchContext(selectedId, { signal: controller.signal });
        if (disposed || current !== generation) return null;
        const location = context?.decisionId === selectedId ? buildMissingMusicDownloadReviewLocation(context) : null;
        if (!location) throw new Error('Review context is unavailable');
        return location;
      } catch (error) {
        if (!disposed && current === generation && error?.name !== 'AbortError' && error?.code !== 'request_aborted') {
          errorMessage.value = error?.status === 403 ? 'Only an administrator can review this download request.'
            : 'This download request could not be opened for review. Refresh the release status.';
        }
        return null;
      } finally { if (!disposed && current === generation) { isLoading.value = false; controller = null; promise = null; } }
    })();
    return promise;
  }
  function destroy() { disposed = true; generation += 1; controller?.abort(); stopWatch(); }
  return { isLoading: readonly(isLoading), errorMessage: readonly(errorMessage), loadLocation, destroy };
}
