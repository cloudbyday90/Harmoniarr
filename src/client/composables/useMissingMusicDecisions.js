/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { fetchMissingMusicDecisions as defaultFetchMissingMusicDecisions } from '../lib/missing-music-api.js';
import { createLatestRequestGate } from '../lib/latest-request-gate.js';
import {
  createMissingMusicDecisionFilters,
  DEFAULT_MISSING_MUSIC_DECISION_FILTERS,
} from '../lib/missing-music-worklist-presentation.js';

function normalizePayload(payload) {
  return {
    checkedAt: payload?.checkedAt ?? null,
    decisions: Array.isArray(payload?.decisions) ? payload.decisions : [],
    filters: payload?.filters ?? {},
    page: payload?.page ?? { limit: 50, total: null, hasMore: false, nextCursor: null },
    scope: payload?.scope ?? 'mine',
    users: Array.isArray(payload?.users) ? payload.users : [],
  };
}

// Navigation commits its payload and cursor history together. Background reads
// may retain this same page; changing filters never retains another user's rows.
export function useMissingMusicDecisions({
  fetchMissingMusicDecisions = defaultFetchMissingMusicDecisions,
  immediate = true,
  initialFilters = DEFAULT_MISSING_MUSIC_DECISION_FILTERS,
  pollIntervalMs = 30000,
  revalidateOnFocus = true,
} = {}) {
  const filters = ref(createMissingMusicDecisionFilters(initialFilters));
  const data = ref(normalizePayload(null));
  const isLoading = ref(immediate);
  const isRevalidating = ref(false);
  const errorMessage = ref('');
  const pageCursors = ref([null]);
  const pageIndex = ref(0);
  const gate = createLatestRequestGate();
  let destroyed = false;
  let hasLoaded = false;
  let pollTimer = null;
  const decisions = computed(() => data.value.decisions);
  const page = computed(() => data.value.page);
  const scope = computed(() => data.value.scope);
  const users = computed(() => data.value.users);
  const pageNumber = computed(() => pageIndex.value + 1);
  const canGoPrevious = computed(() => pageIndex.value > 0);
  const canGoNext = computed(() => page.value.hasMore === true
    && typeof page.value.nextCursor === 'string' && page.value.nextCursor.length > 0);

  function clearPoll() {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  function schedulePoll() {
    clearPoll();
    if (!destroyed && hasLoaded && pollIntervalMs > 0) {
      pollTimer = setTimeout(() => { void refresh(); }, pollIntervalMs);
    }
  }

  async function loadPage({ cursors = pageCursors.value, index = pageIndex.value, navigation = false } = {}) {
    if (destroyed) return false;
    clearPoll();
    const request = gate.begin();
    const requestFilters = { ...filters.value };
    if (cursors[index]) requestFilters.cursor = cursors[index];
    isLoading.value = !hasLoaded || navigation;
    isRevalidating.value = hasLoaded && !navigation;
    errorMessage.value = '';
    try {
      const payload = await fetchMissingMusicDecisions(requestFilters, { signal: request.signal });
      if (!request.isCurrent() || destroyed) return false;
      data.value = normalizePayload(payload);
      pageCursors.value = [...cursors];
      pageIndex.value = index;
      hasLoaded = true;
      return true;
    } catch (error) {
      if (request.isCurrent() && !destroyed) {
        errorMessage.value = error?.message ?? 'Missing Music could not be refreshed.';
      }
      return false;
    } finally {
      if (request.isCurrent() && !destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  function refresh() { return loadPage(); }

  function applyFilters(nextFilters) {
    gate.invalidate();
    filters.value = createMissingMusicDecisionFilters({ ...filters.value, ...nextFilters });
    data.value = { ...data.value, decisions: [], page: normalizePayload(null).page };
    pageCursors.value = [null];
    pageIndex.value = 0;
    hasLoaded = false;
    return loadPage();
  }

  function nextPage() {
    if (isLoading.value || isRevalidating.value || !canGoNext.value) return Promise.resolve(false);
    return loadPage({
      cursors: [...pageCursors.value.slice(0, pageIndex.value + 1), page.value.nextCursor],
      index: pageIndex.value + 1, navigation: true,
    });
  }

  function previousPage() {
    if (isLoading.value || isRevalidating.value || !canGoPrevious.value) return Promise.resolve(false);
    return loadPage({ index: pageIndex.value - 1, navigation: true });
  }

  function firstPage() {
    if (isLoading.value || isRevalidating.value || !canGoPrevious.value) return Promise.resolve(false);
    return loadPage({ cursors: [null], index: 0, navigation: true });
  }

  function handleVisibilityChange() {
    if (!document.hidden && hasLoaded && !isLoading.value && !isRevalidating.value) void refresh();
  }

  function destroy() {
    destroyed = true;
    gate.invalidate();
    clearPoll();
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  onMounted(() => {
    if (revalidateOnFocus) document.addEventListener('visibilitychange', handleVisibilityChange);
    if (immediate) void refresh();
  });
  onBeforeUnmount(destroy);

  return {
    applyFilters, decisions, errorMessage, filters, isLoading, isRevalidating, page, refresh, scope, users,
    pageNumber, canGoPrevious, canGoNext, nextPage, previousPage, firstPage, destroy,
  };
}
