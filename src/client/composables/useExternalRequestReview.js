/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readonly, ref } from 'vue';
import {
  approveExternalRequestRelease,
  fetchExternalRequestReview,
  recoverExternalRequestPreparation,
  searchExternalRequestReleases,
} from '../lib/external-request-review-api.js';
import { createLatestRequestGate } from '../lib/latest-request-gate.js';

export function useExternalRequestReview({
  fetchReviewFn = fetchExternalRequestReview,
  searchReleasesFn = searchExternalRequestReleases,
  approveReleaseFn = approveExternalRequestRelease,
  recoverPreparationFn = recoverExternalRequestPreparation,
} = {}) {
  const items = ref([]);
  const intents = ref([]);
  const preparation = ref({ canRecover: false, action: null });
  const drafts = ref({});
  const isLoading = ref(false);
  const isMutating = ref(false);
  const errorMessage = ref('');
  const statusMessage = ref('');
  const loadGate = createLatestRequestGate();
  const searchGates = new Map();
  let currentMediaRequestId = null;
  let generation = 0;

  function reset() {
    generation += 1;
    loadGate.invalidate();
    for (const gate of searchGates.values()) gate.invalidate();
    searchGates.clear();
    currentMediaRequestId = null;
    items.value = [];
    intents.value = [];
    preparation.value = { canRecover: false, action: null };
    drafts.value = {};
    isLoading.value = false;
    isMutating.value = false;
    errorMessage.value = '';
    statusMessage.value = '';
  }

  async function load({ mediaRequestId, preserveStatus = false }) {
    if (mediaRequestId !== currentMediaRequestId) reset();
    currentMediaRequestId = mediaRequestId;
    const request = loadGate.begin();
    isLoading.value = true;
    errorMessage.value = '';
    if (!preserveStatus) statusMessage.value = 'Loading external request review.';
    try {
      const payload = await fetchReviewFn({ mediaRequestId, signal: request.signal });
      if (!request.isCurrent()) return;
      items.value = payload.items ?? [];
      intents.value = payload.intents ?? [];
      preparation.value = payload.preparation ?? { canRecover: false, action: null };
      for (const item of items.value) {
        drafts.value[item.id] ??= {
          artistName: item.artistName ?? '', releaseTitle: item.title ?? '',
          releases: [], selectedReleaseId: '', isSearching: false,
          searchComplete: false, errorMessage: '', statusMessage: '',
        };
      }
      if (!preserveStatus) statusMessage.value = 'External request review updated.';
    } catch (error) {
      if (request.isCurrent()) {
        errorMessage.value = error instanceof Error ? error.message : 'Could not load external request review.';
        if (!preserveStatus) statusMessage.value = '';
      }
    } finally {
      if (request.isCurrent()) isLoading.value = false;
    }
  }

  async function search(itemId) {
    const draft = drafts.value[itemId];
    if (!draft || isMutating.value || !draft.artistName.trim() || !draft.releaseTitle.trim()) return;
    const gate = searchGates.get(itemId) ?? createLatestRequestGate();
    searchGates.set(itemId, gate);
    const request = gate.begin();
    const ownerGeneration = generation;
    draft.isSearching = true;
    draft.errorMessage = '';
    draft.statusMessage = 'Searching the local release catalog.';
    draft.selectedReleaseId = '';
    draft.searchComplete = false;
    draft.releases = [];
    try {
      const payload = await searchReleasesFn({
        mediaRequestId: currentMediaRequestId, artistName: draft.artistName,
        releaseTitle: draft.releaseTitle, signal: request.signal,
      });
      if (!request.isCurrent() || ownerGeneration !== generation) return;
      draft.releases = payload.releases ?? [];
      draft.searchComplete = true;
      draft.statusMessage = `${draft.releases.length} local release${draft.releases.length === 1 ? '' : 's'} found.`;
    } catch (error) {
      if (request.isCurrent() && ownerGeneration === generation) {
        draft.errorMessage = error instanceof Error ? error.message : 'Could not search the local release catalog.';
        draft.statusMessage = '';
      }
    } finally {
      if (request.isCurrent() && ownerGeneration === generation) draft.isSearching = false;
    }
  }

  async function mutate(action, successMessage) {
    if (isMutating.value || !currentMediaRequestId) return null;
    const ownerGeneration = generation;
    const mediaRequestId = currentMediaRequestId;
    isMutating.value = true;
    errorMessage.value = '';
    statusMessage.value = '';
    try {
      const result = await action(mediaRequestId);
      if (ownerGeneration !== generation) return null;
      statusMessage.value = successMessage(result);
      await load({ mediaRequestId, preserveStatus: true });
      return ownerGeneration === generation ? result : null;
    } catch (error) {
      if (ownerGeneration === generation) {
        errorMessage.value = error instanceof Error ? error.message : 'Could not save this review. Check the request before trying again.';
      }
      return null;
    } finally {
      if (ownerGeneration === generation) isMutating.value = false;
    }
  }

  async function approve(itemId) {
    const item = items.value.find((candidate) => candidate.id === itemId);
    const draft = drafts.value[itemId];
    if (!item?.reviewable || !draft?.selectedReleaseId || draft.isSearching
      || !draft.releases.some((release) => release.id === draft.selectedReleaseId)) return null;
    const metadataReleaseId = draft.selectedReleaseId;
    return mutate(
      (mediaRequestId) => approveReleaseFn({ mediaRequestId, providerIngestRequestId: itemId, metadataReleaseId }),
      (result) => result.reusedExistingIntent
        ? 'This release already has an accepted search. Import candidates still require review.'
        : 'Release search queued. Import candidates will require review before download or import.',
    );
  }

  async function recover() {
    if (!preparation.value.canRecover) return null;
    const action = preparation.value.action;
    return mutate(
      (mediaRequestId) => recoverPreparationFn({ mediaRequestId }),
      (result) => result.reusedExistingRun
        ? 'Preparation is already queued or running.'
        : action === 'execute' ? 'Provider metadata preparation queued.' : 'External request planning queued.',
    );
  }

  return {
    items: readonly(items), intents: readonly(intents), preparation: readonly(preparation),
    drafts, isLoading: readonly(isLoading), isMutating: readonly(isMutating),
    errorMessage: readonly(errorMessage), statusMessage: readonly(statusMessage),
    load, search, approve, recover, reset,
  };
}
