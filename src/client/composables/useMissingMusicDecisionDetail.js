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

import { computed, onBeforeUnmount, onMounted, ref, toValue, watch } from 'vue';
import { fetchMissingMusicDecisionDetail as defaultFetchMissingMusicDecisionDetail } from '../lib/missing-music-api.js';
import { createLatestRequestGate } from '../lib/latest-request-gate.js';
import { projectSlskdSearchDiagnostics } from '../../shared/slskd-search-diagnostics.js';
import { buildMissingMusicMatchPageMessage } from '../lib/missing-music-match-selection-presentation.js';

function normalizeDecisionId(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeDetail(payload) {
  if (!payload?.decision || typeof payload.decision !== 'object') {
    return null;
  }

  return {
    checkedAt: payload.checkedAt ?? null,
    decision: payload.decision,
    qualityEvidence: payload.qualityEvidence ?? null,
    searchDiagnostics: projectSlskdSearchDiagnostics(payload.searchDiagnostics),
    libraryAddRecovery: payload.libraryAddRecovery ?? null,
    libraryAddReview: payload.libraryAddReview ?? null,
    permissions: {
      canAddToLibrary: payload.permissions?.canAddToLibrary === true,
      canAllowFallbackQuality: payload.permissions?.canAllowFallbackQuality === true,
      canFindMatches: payload.permissions?.canFindMatches === true,
      canRecheckLibraryAdd: payload.permissions?.canRecheckLibraryAdd === true,
      canRepairFolders: payload.permissions?.canRepairFolders === true,
      canReviewDownloadHandoff: payload.permissions?.canReviewDownloadHandoff === true,
      canReviewIgnoredSources: payload.permissions?.canReviewIgnoredSources === true,
      canReviewProviderConnection: payload.permissions?.canReviewProviderConnection === true,
      canStartDownload: payload.permissions?.canStartDownload === true,
      canSearchAgain: payload.permissions?.canSearchAgain === true,
      canSelectMatch: payload.permissions?.canSelectMatch === true,
      canChooseAnotherMatch: payload.permissions?.canChooseAnotherMatch === true,
      canViewDownloader: payload.permissions?.canViewDownloader === true,
      isReadOnly: payload.permissions?.isReadOnly === true,
    },
    matchChoices: Array.isArray(payload.matchChoices) ? payload.matchChoices : [],
    matchChoicePage: payload.matchChoicePage ? {
      nextCursor: typeof payload.matchChoicePage.nextCursor === 'string' ? payload.matchChoicePage.nextCursor : null,
      previousCursor: typeof payload.matchChoicePage.previousCursor === 'string' ? payload.matchChoicePage.previousCursor : null,
      scanIncomplete: payload.matchChoicePage.scanIncomplete === true,
      scanDirection: payload.matchChoicePage.scanDirection === 'previous' ? 'previous' : 'next',
      canReturnToFirst: payload.matchChoicePage.canReturnToFirst === true,
    } : null,
    scope: payload.scope ?? 'mine',
  };
}

export function isMissingMusicDecisionNotFoundError(error) {
  return error?.status === 404 && error?.code === 'missing_music_decision_not_found';
}

/**
 * Fetches one server-authorized Missing Music release detail. A request
 * sequence guard keeps a slower, previous route read from replacing the
 * current release after navigation.
 */
export function useMissingMusicDecisionDetail({
  fetchMissingMusicDecisionDetail = defaultFetchMissingMusicDecisionDetail,
  immediate = true,
  decisionId = null,
  pollIntervalMs = 30000,
  revalidateOnFocus = true,
} = {}) {
  const detail = ref(null);
  const detailDecisionId = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(false);
  const isRevalidating = ref(false);
  const isNotFound = ref(false);
  const matchPageStatus = ref('');
  const isNavigatingMatches = ref(false);
  const resolvedDecisionId = computed(() => normalizeDecisionId(toValue(decisionId)));
  let disposed = false;
  const gate = createLatestRequestGate();
  let pendingRead = null;
  let pollTimer = null;
  let paused = false;
  let isInitialLoad = true;
  let acceptedMatchCursor = null;
  let pendingMatchCursor = null;
  let readGeneration = 0;

  function clearPoll() {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  function isHidden() {
    return typeof document !== 'undefined' && document.hidden;
  }

  function schedulePoll() {
    clearPoll();
    if (disposed || paused || isHidden() || !resolvedDecisionId.value || pollIntervalMs <= 0) return;
    pollTimer = setTimeout(() => { void load(); }, pollIntervalMs);
  }

  function invalidateRead() {
    readGeneration++;
    isNavigatingMatches.value = false;
    if (matchPageStatus.value === 'Loading matches…') matchPageStatus.value = '';
    gate.invalidate();
    pendingRead = null;
    clearPoll();
    isLoading.value = false;
    isRevalidating.value = false;
  }

  function applyDetail(payload, { invalidatePending = true } = {}) {
    const normalizedDetail = normalizeDetail(payload);
    if (disposed || !normalizedDetail
      || normalizedDetail.decision.decisionId !== resolvedDecisionId.value) {
      return null;
    }

    if (invalidatePending) {
      invalidateRead();
      acceptedMatchCursor = null;
    }

    detail.value = normalizedDetail;
    detailDecisionId.value = normalizedDetail.decision.decisionId ?? null;
    errorMessage.value = '';
    isNotFound.value = false;
    if (invalidatePending) schedulePoll();
    return normalizedDetail;
  }

  function load({ matchCursor = acceptedMatchCursor } = {}) {
    if (disposed || paused || !resolvedDecisionId.value) return Promise.resolve(null);
    if (pendingRead) return pendingRead;

    clearPoll();
    const request = gate.begin();
    pendingMatchCursor = matchCursor;
    const currentDecisionId = resolvedDecisionId.value;
    const hasDetail = detail.value?.decision.decisionId === currentDecisionId;
    errorMessage.value = '';
    isNotFound.value = false;
    detailDecisionId.value = currentDecisionId;
    isLoading.value = !hasDetail;
    isRevalidating.value = hasDetail;

    const read = (async () => {
      // Keep synchronous fetcher failures on the same asynchronous lifecycle.
      await Promise.resolve();
      try {
        const fetchDetail = cursor => fetchMissingMusicDecisionDetail(currentDecisionId, {
          signal: request.signal, ...(cursor != null ? { matchCursor: cursor } : {}),
        });
        let payload;
        let currentCursor = matchCursor;
        let resetPage = false;
        try { payload = await fetchDetail(currentCursor); }
        catch (error) {
          if (currentCursor == null || error?.code !== 'missing_music_match_page_changed' || !request.isCurrent()) throw error;
          currentCursor = null;
          resetPage = true;
          payload = await fetchDetail(null);
        }
        if (disposed || !request.isCurrent()) return null;

        if (!payload?.decision || payload.decision.decisionId !== currentDecisionId) {
          throw new Error('Missing Music release details failed to load');
        }
        const applied = applyDetail(payload, { invalidatePending: false });
        acceptedMatchCursor = currentCursor;
        if (resetPage) matchPageStatus.value = 'Matches changed. Showing the first page.';
        return applied;
      } catch (error) {
        if (disposed || !request.isCurrent()) return null;
        if (isMissingMusicDecisionNotFoundError(error)) {
          detail.value = null;
          isNotFound.value = true;
          return null;
        }
        if (error?.status === 401 || error?.status === 403) detail.value = null;
        errorMessage.value = 'Missing Music release details could not be refreshed. Try again.';
        return null;
      } finally {
        if (!disposed && request.isCurrent()) {
          pendingRead = null;
          isLoading.value = false;
          isRevalidating.value = false;
          schedulePoll();
        }
      }
    })();
    pendingRead = read;
    return read;
  }

  function refresh() {
    if (pendingRead && pendingMatchCursor == null) return pendingRead;
    invalidateRead();
    matchPageStatus.value = '';
    return load({ matchCursor: null });
  }

  async function loadMatchPage(cursor) {
    if (paused || disposed || (cursor !== null && typeof cursor !== 'string')) return null;
    invalidateRead();
    matchPageStatus.value = 'Loading matches…';
    isNavigatingMatches.value = true;
    const generation = readGeneration;
    const result = await load({ matchCursor: cursor });
    if (generation !== readGeneration) return result;
    isNavigatingMatches.value = false;
    if (result && matchPageStatus.value === 'Loading matches…') {
      const count = result.matchChoices.length;
      matchPageStatus.value = buildMissingMusicMatchPageMessage(result) || `Showing ${count} ${count === 1 ? 'match' : 'matches'}.`;
    }
    else if (!result && matchPageStatus.value === 'Loading matches…') matchPageStatus.value = 'Matches could not be loaded. Try again.';
    return result;
  }

  function setPaused(value) {
    paused = value === true;
    if (paused) invalidateRead();
    else if (!detail.value && !isHidden()) void load();
    else schedulePoll();
  }

  function handleVisibilityChange() {
    if (isHidden()) {
      invalidateRead();
    } else if (!disposed && revalidateOnFocus) {
      void load();
    }
  }

  function handleWindowFocus() {
    if (!disposed && !isHidden() && revalidateOnFocus) void load();
  }

  watch(resolvedDecisionId, () => {
    invalidateRead();
    detail.value = null;
    acceptedMatchCursor = null;
    matchPageStatus.value = '';
    detailDecisionId.value = resolvedDecisionId.value;
    errorMessage.value = '';
    isNotFound.value = false;
    if (immediate || !isInitialLoad) {
      void load();
    }
    isInitialLoad = false;
  }, { immediate: true, flush: 'sync' });

  onMounted(() => {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibilityChange);
    if (typeof window !== 'undefined' && revalidateOnFocus) window.addEventListener('focus', handleWindowFocus);
  });

  onBeforeUnmount(() => {
    disposed = true;
    invalidateRead();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (typeof window !== 'undefined' && revalidateOnFocus) window.removeEventListener('focus', handleWindowFocus);
  });

  return {
    applyDetail,
    detail,
    detailDecisionId,
    errorMessage,
    isLoading,
    isRevalidating,
    isNotFound,
    matchPageStatus,
    isNavigatingMatches,
    load,
    loadMatchPage,
    refresh,
    setPaused,
  };
}
