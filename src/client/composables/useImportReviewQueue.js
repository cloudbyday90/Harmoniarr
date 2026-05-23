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

import { computed, readonly, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  fetchImportCandidate,
  fetchImportCandidates,
  holdImportCandidate,
  rejectImportCandidate,
  reopenImportCandidate,
  selectImportCandidate,
} from '../lib/import-candidate-api.js';
import {
  createEmptyQueue,
  defaultImportReviewFilters,
  normalizeCandidatePayload,
  normalizeFilterValue,
  normalizeQueuePayload,
  normalizeReviewPayload,
} from '../lib/import-review-queue-normalization.js';

const defaultFilters = defaultImportReviewFilters;

const activeCandidateStatuses = new Set([
  'pending',
  'selected',
  'downloading',
  'import_pending',
]);

function hasActiveCandidates(queueValue) {
  return (queueValue?.candidates ?? []).some(
    (c) => activeCandidateStatuses.has(c.status),
  );
}

export function useImportReviewQueue({
  fetchCandidate = fetchImportCandidate,
  getNow = () => new Date(),
  holdCandidate = holdImportCandidate,
  listCandidates = fetchImportCandidates,
  pollIntervalMs = 0,
  rejectCandidate = rejectImportCandidate,
  reopenCandidate = reopenImportCandidate,
  revalidateOnFocus = false,
  selectCandidateForDownload = selectImportCandidate,
} = {}) {
  const folderPathFilter = ref(defaultFilters.folderPath);
  const sourceSearchIdFilter = ref(defaultFilters.sourceSearchId);
  const statusFilter = ref(defaultFilters.status);
  const usernameFilter = ref(defaultFilters.username);
  const limit = ref(defaultFilters.limit);
  const offset = ref(defaultFilters.offset);

  const queue = ref(createEmptyQueue());
  const selectedCandidateId = ref(null);
  const selectedCandidate = ref(null);
  const actionReason = ref('');

  const listError = ref('');
  const detailError = ref('');
  const actionError = ref('');
  const isLoadingQueue = ref(false);
  const isRevalidating = ref(false);
  const isLoadingCandidate = ref(false);
  const isTransitionPending = ref(false);
  const lastLoadedAt = ref(null);
  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;

  const candidates = computed(() => queue.value.candidates ?? []);
  const pagination = computed(() => queue.value.pagination ?? createEmptyQueue().pagination);
  const activeFilterCount = computed(() => [
    folderPathFilter.value,
    sourceSearchIdFilter.value,
    statusFilter.value,
    usernameFilter.value,
  ].filter(Boolean).length);

  function currentFilters() {
    return {
      folderPath: normalizeFilterValue(folderPathFilter.value),
      limit: limit.value,
      offset: offset.value,
      sourceSearchId: normalizeFilterValue(sourceSearchIdFilter.value),
      status: normalizeFilterValue(statusFilter.value),
      username: normalizeFilterValue(usernameFilter.value),
    };
  }

  function syncSelectedCandidateFromQueue() {
    if (!selectedCandidate.value) {
      return;
    }

    const queueCandidate = candidates.value.find((candidate) => candidate.id === selectedCandidate.value.id);
    if (queueCandidate) {
      selectedCandidate.value = {
        ...selectedCandidate.value,
        ...queueCandidate,
        files: selectedCandidate.value.files ?? [],
      };
    }
  }

  function clearSelection() {
    selectedCandidateId.value = null;
    selectedCandidate.value = null;
    detailError.value = '';
    actionError.value = '';
    actionReason.value = '';
  }

  function setFilters({
    folderPath,
    sourceSearchId,
    status,
    username,
  } = {}) {
    folderPathFilter.value = folderPath === undefined
      ? folderPathFilter.value
      : normalizeFilterValue(folderPath);
    sourceSearchIdFilter.value = sourceSearchId === undefined
      ? sourceSearchIdFilter.value
      : normalizeFilterValue(sourceSearchId);
    statusFilter.value = status === undefined
      ? statusFilter.value
      : normalizeFilterValue(status);
    usernameFilter.value = username === undefined
      ? usernameFilter.value
      : normalizeFilterValue(username);
  }

  function resetFilters() {
    folderPathFilter.value = defaultFilters.folderPath;
    sourceSearchIdFilter.value = defaultFilters.sourceSearchId;
    statusFilter.value = defaultFilters.status;
    usernameFilter.value = defaultFilters.username;
    limit.value = defaultFilters.limit;
    offset.value = defaultFilters.offset;
  }

  function clearPollTimer() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll() {
    clearPollTimer();
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    if (destroyed) return;
    if (!hasActiveCandidates(queue.value)) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await loadQueue();
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    void loadQueue().then(() => {
      if (!destroyed) schedulePoll();
    });
  }

  function destroy() {
    destroyed = true;
    clearPollTimer();
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  function attachVisibilityListener() {
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  async function loadQueue() {
    if (destroyed) return queue.value;
    listError.value = '';

    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoadingQueue.value = true;
    }

    try {
      queue.value = normalizeQueuePayload(await listCandidates(currentFilters()));
      lastLoadedAt.value = getNow().toISOString();
      syncSelectedCandidateFromQueue();
      hasLoaded = true;
      return queue.value;
    } catch (error) {
      if (!isRevalidation) {
        queue.value = createEmptyQueue();
      }
      listError.value = getErrorMessage(error, 'Import review queue failed to load');
      return queue.value;
    } finally {
      if (!destroyed) {
        isLoadingQueue.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  async function selectCandidate(importCandidateId, { forceReload = false } = {}) {
    if (!importCandidateId) {
      clearSelection();
      return null;
    }

    selectedCandidateId.value = importCandidateId;
    detailError.value = '';
    actionError.value = '';

    if (!forceReload && selectedCandidate.value?.id === importCandidateId) {
      syncSelectedCandidateFromQueue();
      return selectedCandidate.value;
    }

    isLoadingCandidate.value = true;
    try {
      selectedCandidate.value = normalizeCandidatePayload(await fetchCandidate(importCandidateId));
      syncSelectedCandidateFromQueue();
      return selectedCandidate.value;
    } catch (error) {
      selectedCandidate.value = null;
      detailError.value = getErrorMessage(error, 'Import candidate detail failed to load');
      return null;
    } finally {
      isLoadingCandidate.value = false;
    }
  }

  async function reconcileSelection({ fallbackToFirstCandidate = false, forceReload = false } = {}) {
    const hasCurrentSelection = selectedCandidateId.value
      && candidates.value.some((candidate) => candidate.id === selectedCandidateId.value);

    if (hasCurrentSelection) {
      syncSelectedCandidateFromQueue();
      if (forceReload) {
        await selectCandidate(selectedCandidateId.value, { forceReload: true });
      }
      return selectedCandidate.value;
    }

    if (fallbackToFirstCandidate && candidates.value.length) {
      return selectCandidate(candidates.value[0].id, { forceReload });
    }

    clearSelection();
    return null;
  }

  async function transitionSelectedCandidate(transitionFn, fallbackMessage) {
    if (!selectedCandidateId.value) {
      return null;
    }

    actionError.value = '';
    isTransitionPending.value = true;

    try {
      const review = normalizeReviewPayload(await transitionFn(selectedCandidateId.value, actionReason.value));
      const transitionedCandidateId = review?.candidate?.id ?? selectedCandidateId.value;

      await loadQueue();

      if (candidates.value.some((candidate) => candidate.id === transitionedCandidateId)) {
        await selectCandidate(transitionedCandidateId, { forceReload: true });
      } else {
        await reconcileSelection({ fallbackToFirstCandidate: true, forceReload: true });
      }

      actionReason.value = '';
      return review;
    } catch (error) {
      actionError.value = getErrorMessage(error, fallbackMessage);
      return null;
    } finally {
      isTransitionPending.value = false;
    }
  }

  function holdSelectedCandidate() {
    return transitionSelectedCandidate(holdCandidate, 'Holding the import candidate failed');
  }

  function selectSelectedCandidate() {
    return transitionSelectedCandidate(selectCandidateForDownload, 'Selecting the import candidate failed');
  }

  function rejectSelectedCandidate() {
    return transitionSelectedCandidate(rejectCandidate, 'Rejecting the import candidate failed');
  }

  function reopenSelectedCandidate() {
    return transitionSelectedCandidate(reopenCandidate, 'Reopening the import candidate failed');
  }

  return {
    actionError,
    actionReason,
    activeFilterCount,
    attachVisibilityListener,
    candidates,
    clearSelection,
    destroy,
    detailError,
    folderPathFilter,
    holdSelectedCandidate,
    isLoadingCandidate,
    isLoadingQueue,
    isRevalidating: readonly(isRevalidating),
    isTransitionPending,
    lastLoadedAt,
    limit,
    listError,
    loadQueue,
    offset,
    pagination,
    reconcileSelection,
    rejectSelectedCandidate,
    reopenSelectedCandidate,
    resetFilters,
    selectSelectedCandidate,
    selectedCandidate,
    selectedCandidateId,
    selectCandidate,
    setFilters,
    sourceSearchIdFilter,
    statusFilter,
    usernameFilter,
  };
}