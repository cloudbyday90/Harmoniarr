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
    libraryAddRecovery: payload.libraryAddRecovery ?? null,
    permissions: {
      canAllowFallbackQuality: payload.permissions?.canAllowFallbackQuality === true,
      canFindMatches: payload.permissions?.canFindMatches === true,
      canRecheckLibraryAdd: payload.permissions?.canRecheckLibraryAdd === true,
      canRepairFolders: payload.permissions?.canRepairFolders === true,
      canStartDownload: payload.permissions?.canStartDownload === true,
      canSearchAgain: payload.permissions?.canSearchAgain === true,
      canSelectMatch: payload.permissions?.canSelectMatch === true,
      canViewDownloader: payload.permissions?.canViewDownloader === true,
      isReadOnly: payload.permissions?.isReadOnly === true,
    },
    matchChoices: Array.isArray(payload.matchChoices) ? payload.matchChoices : [],
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
  const resolvedDecisionId = computed(() => normalizeDecisionId(toValue(decisionId)));
  let disposed = false;
  const gate = createLatestRequestGate();
  let pendingRead = null;
  let pollTimer = null;
  let paused = false;
  let isInitialLoad = true;

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
    }

    detail.value = normalizedDetail;
    detailDecisionId.value = normalizedDetail.decision.decisionId ?? null;
    errorMessage.value = '';
    isNotFound.value = false;
    if (invalidatePending) schedulePoll();
    return normalizedDetail;
  }

  function load() {
    if (disposed || paused || !resolvedDecisionId.value) return Promise.resolve(null);
    if (pendingRead) return pendingRead;

    clearPoll();
    const request = gate.begin();
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
        const payload = await fetchMissingMusicDecisionDetail(currentDecisionId, { signal: request.signal });
        if (disposed || !request.isCurrent()) return null;

        if (!payload?.decision || payload.decision.decisionId !== currentDecisionId) {
          throw new Error('Missing Music release details failed to load');
        }
        return applyDetail(payload, { invalidatePending: false });
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
    load,
    refresh: load,
    setPaused,
  };
}
