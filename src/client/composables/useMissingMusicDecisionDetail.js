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

import { computed, onBeforeUnmount, ref, toValue, watch } from 'vue';
import { fetchMissingMusicDecisionDetail as defaultFetchMissingMusicDecisionDetail } from '../lib/missing-music-api.js';
import { getErrorMessage } from '../lib/error-utils.js';

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
    permissions: {
      canStartDownload: payload.permissions?.canStartDownload === true,
      canSelectMatch: payload.permissions?.canSelectMatch === true,
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
} = {}) {
  const detail = ref(null);
  const detailDecisionId = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(false);
  const isNotFound = ref(false);
  const resolvedDecisionId = computed(() => normalizeDecisionId(toValue(decisionId)));
  let disposed = false;
  let requestSequence = 0;
  let isInitialLoad = true;

  function applyDetail(payload, { invalidatePending = true } = {}) {
    const normalizedDetail = normalizeDetail(payload);
    if (!normalizedDetail) {
      return null;
    }

    if (invalidatePending) {
      requestSequence += 1;
      isLoading.value = false;
    }

    detail.value = normalizedDetail;
    detailDecisionId.value = normalizedDetail.decision.decisionId ?? null;
    errorMessage.value = '';
    isNotFound.value = false;
    return normalizedDetail;
  }

  async function load() {
    const requestId = ++requestSequence;
    const currentDecisionId = resolvedDecisionId.value;

    detail.value = null;
    errorMessage.value = '';
    isNotFound.value = false;

    if (!currentDecisionId) {
      detailDecisionId.value = null;
      isLoading.value = false;
      return null;
    }

    detailDecisionId.value = currentDecisionId;
    isLoading.value = true;

    try {
      const payload = await fetchMissingMusicDecisionDetail(currentDecisionId);
      if (disposed || requestId !== requestSequence) return null;

      if (!payload?.decision || typeof payload.decision !== 'object') {
        throw new Error('Missing Music release details failed to load');
      }

      return applyDetail(payload, { invalidatePending: false });
    } catch (error) {
      if (disposed || requestId !== requestSequence) return null;

      if (isMissingMusicDecisionNotFoundError(error)) {
        isNotFound.value = true;
        return null;
      }

      errorMessage.value = getErrorMessage(error, 'Missing Music release details failed to load');
      return null;
    } finally {
      if (!disposed && requestId === requestSequence) {
        isLoading.value = false;
      }
    }
  }

  watch(resolvedDecisionId, () => {
    if (immediate || !isInitialLoad) {
      void load();
    }
    isInitialLoad = false;
  }, { immediate: true });

  onBeforeUnmount(() => {
    disposed = true;
    requestSequence += 1;
  });

  return {
    applyDetail,
    detail,
    detailDecisionId,
    errorMessage,
    isLoading,
    isNotFound,
    load,
  };
}
