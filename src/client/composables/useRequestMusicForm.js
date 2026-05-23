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

import { computed, reactive, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  createMediaRequest as defaultCreateMediaRequest,
  fetchMediaRequests as defaultFetchMediaRequests,
  fetchMediaRequestSummary as defaultFetchMediaRequestSummary,
} from '../lib/library-api.js';
import { fetchUsers as defaultFetchUsers } from '../lib/users-api.js';
import {
  buildMediaRequestPayload,
  buildMediaRequestSuccessMessage,
} from '../lib/request-music-form.js';

/**
 * Composable that manages all state for the request-music intake view.
 *
 * Encapsulates form state, submission, summary loading, request history
 * loading, and admin scope/target management. All API dependencies are
 * injectable so the composable is fully testable under Node without a
 * running server or component instance.
 *
 * The caller is responsible for triggering `loadRequestDashboard()` and
 * `loadRequestTargets()` — typically from the view's own `onMounted` hook.
 *
 * @param {object} [options]
 * @param {string} [options.initialScope] - 'all' | 'mine'. Default 'mine'.
 * @param {boolean} [options.isAdmin] - Whether the current user is an admin. Default false.
 * @param {string} [options.currentUserId] - The current user's ID. Default ''.
 * @param {function} [options.createMediaRequestFn] - Override for testing.
 * @param {function} [options.fetchMediaRequestsFn] - Override for testing.
 * @param {function} [options.fetchMediaRequestSummaryFn] - Override for testing.
 * @param {function} [options.fetchUsersFn] - Override for testing.
 * @param {number} [options.pollIntervalMs] - SWR polling interval in ms. Polls
 *   only while visible requests have active fulfillment. Default 0 (disabled).
 */
export function useRequestMusicForm({
  initialScope = 'mine',
  isAdmin = false,
  currentUserId = '',
  createMediaRequestFn = defaultCreateMediaRequest,
  fetchMediaRequestsFn = defaultFetchMediaRequests,
  fetchMediaRequestSummaryFn = defaultFetchMediaRequestSummary,
  fetchUsersFn = defaultFetchUsers,
  pollIntervalMs = 0,
} = {}) {
  // ── Summary & history ────────────────────────────────────────────────────
  const summary = ref(null);
  const mediaRequests = ref([]);
  const isLoading = ref(false);
  const isRevalidating = ref(false);
  const loadError = ref('');
  const selectedScope = ref(initialScope);
  const totalCount = ref(0);
  const currentOffset = ref(0);
  const pageSize = 50;
  let pollTimer = null;
  let destroyed = false;
  let lastFilterParams = {};

  const hasActiveFulfillment = computed(() => {
    const counts = summary.value?.fulfillmentCounts;
    if (!counts) return false;
    return (counts.active ?? 0) > 0 || (counts.downloading ?? 0) > 0 || (counts.importPending ?? 0) > 0;
  });

  const hasMore = computed(() => mediaRequests.value.length < totalCount.value);
  const isLoadingMore = ref(false);

  // ── Request targets (admin only) ─────────────────────────────────────────
  const requestTargets = ref([]);
  const isLoadingTargets = ref(false);
  const targetErrorMessage = ref('');

  // ── Form state ───────────────────────────────────────────────────────────
  const form = reactive({
    artistName: '',
    notes: '',
    releaseTitle: '',
    requestKind: 'release',
    requestedForUserId: '',
    requestedForUserIds: [],
    sourceUrl: '',
    trackTitle: '',
  });

  const isSubmitting = ref(false);
  const errorMessage = ref('');
  const successMessage = ref('');

  // ── Computed ─────────────────────────────────────────────────────────────
  const selectedTargetUser = computed(() => {
    return requestTargets.value.find((user) => user.id === form.requestedForUserId) ?? null;
  });

  const canSubmit = computed(() => {
    if (form.requestKind === 'external_url') {
      return form.sourceUrl.trim().length > 0;
    }

    if (form.requestKind === 'track') {
      return form.artistName.trim().length > 0 && form.trackTitle.trim().length > 0;
    }

    return form.artistName.trim().length > 0 && form.releaseTitle.trim().length > 0;
  });

  // ── Internal helpers ─────────────────────────────────────────────────────
  function applyDefaultRequestTarget() {
    if (!isAdmin) {
      form.requestedForUserId = '';
      return;
    }

    const preferredTarget = requestTargets.value.find((user) => user.id === currentUserId);
    form.requestedForUserId = preferredTarget?.id ?? requestTargets.value[0]?.id ?? '';
  }

  // ── Public actions ───────────────────────────────────────────────────────
  function resetForm() {
    form.artistName = '';
    form.notes = '';
    form.releaseTitle = '';
    form.requestKind = 'release';
    form.requestedForUserIds = [];
    form.sourceUrl = '';
    form.trackTitle = '';
    applyDefaultRequestTarget();
  }

  async function loadRequestDashboard({ requestState, requestKind, search } = {}) {
    if (destroyed) return;

    const isRevalidation = summary.value !== null;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }
    loadError.value = '';
    currentOffset.value = 0;

    const requestParams = { scope: selectedScope.value, requestState, requestKind, search, limit: pageSize, offset: 0 };
    lastFilterParams = requestParams;

    try {
      const [summaryPayload, requestsPayload] = await Promise.all([
        fetchMediaRequestSummaryFn({ scope: selectedScope.value }),
        fetchMediaRequestsFn(requestParams),
      ]);

      if (destroyed) return;
      summary.value = summaryPayload;
      mediaRequests.value = requestsPayload.mediaRequests ?? [];
      totalCount.value = requestsPayload.totalCount ?? mediaRequests.value.length;
    } catch (error) {
      if (destroyed) return;
      loadError.value = getErrorMessage(error, 'Music request dashboard could not be loaded');
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
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
    if (!hasActiveFulfillment.value) return;
    if (destroyed) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await loadRequestDashboard(lastFilterParams);
    }, pollIntervalMs);
  }

  function destroy() {
    destroyed = true;
    clearPollTimer();
  }

  async function loadMoreRequests({ requestState, requestKind, search } = {}) {
    if (isLoadingMore.value || !hasMore.value) return;
    isLoadingMore.value = true;

    const nextOffset = currentOffset.value + pageSize;
    const requestParams = { scope: selectedScope.value, requestState, requestKind, search, limit: pageSize, offset: nextOffset };

    try {
      const requestsPayload = await fetchMediaRequestsFn(requestParams);
      const newRequests = requestsPayload.mediaRequests ?? [];
      mediaRequests.value = [...mediaRequests.value, ...newRequests];
      totalCount.value = requestsPayload.totalCount ?? totalCount.value;
      currentOffset.value = nextOffset;
    } catch {
      // silent — user can retry
    } finally {
      isLoadingMore.value = false;
    }
  }

  async function loadRequestTargets() {
    if (!isAdmin) {
      requestTargets.value = [];
      form.requestedForUserId = '';
      return;
    }

    isLoadingTargets.value = true;
    targetErrorMessage.value = '';

    try {
      const payload = await fetchUsersFn();
      requestTargets.value = (payload.users ?? []).filter((user) => user.mediaRequestTarget?.eligible);
      applyDefaultRequestTarget();
    } catch (error) {
      requestTargets.value = [];
      applyDefaultRequestTarget();
      targetErrorMessage.value = getErrorMessage(error, 'Eligible request targets could not be loaded');
    } finally {
      isLoadingTargets.value = false;
    }
  }

  async function submitRequest() {
    isSubmitting.value = true;
    errorMessage.value = '';
    successMessage.value = '';

    try {
      const result = await createMediaRequestFn(buildMediaRequestPayload({ form, isAdmin }));
      successMessage.value = buildMediaRequestSuccessMessage(result.mediaRequest, currentUserId);
      resetForm();
      await loadRequestDashboard();
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Music request submission failed');
    } finally {
      isSubmitting.value = false;
    }
  }

  async function switchScope(scope) {
    if (!isAdmin || selectedScope.value === scope) {
      return;
    }

    selectedScope.value = scope;
    await loadRequestDashboard();
  }

  return {
    canSubmit,
    destroy,
    errorMessage,
    form,
    hasActiveFulfillment,
    hasMore,
    isLoading,
    isLoadingMore,
    isLoadingTargets,
    isRevalidating,
    isSubmitting,
    loadError,
    loadMoreRequests,
    loadRequestDashboard,
    loadRequestTargets,
    mediaRequests,
    requestTargets,
    resetForm,
    selectedScope,
    selectedTargetUser,
    submitRequest,
    successMessage,
    summary,
    switchScope,
    targetErrorMessage,
  };
}
