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

import { ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import { fetchActivitySourceUsers as defaultFetchActivitySourceUsers } from '../lib/activity-api.js';

function emptyCounts() {
  return {
    blocked: 0,
    needsReview: 0,
    neutral: 0,
    preferred: 0,
    total: 0,
    trusted: 0,
    unknown: 0,
    withEvidence: 0,
  };
}

export function useSourceUserTrust({
  fetchActivitySourceUsers = defaultFetchActivitySourceUsers,
} = {}) {
  const checkedAt = ref(null);
  const counts = ref(emptyCounts());
  const errorMessage = ref('');
  const isLoading = ref(false);
  const sourceUsers = ref([]);
  const total = ref(0);

  async function load({ query, trustState } = {}) {
    isLoading.value = true;
    errorMessage.value = '';

    try {
      const payload = await fetchActivitySourceUsers({ query, trustState });
      sourceUsers.value = Array.isArray(payload?.sourceUsers) ? payload.sourceUsers : [];
      counts.value = payload?.counts && typeof payload.counts === 'object'
        ? {
          blocked: Number.isFinite(payload.counts.blocked) ? payload.counts.blocked : 0,
          needsReview: Number.isFinite(payload.counts.needsReview) ? payload.counts.needsReview : 0,
          neutral: Number.isFinite(payload.counts.neutral) ? payload.counts.neutral : 0,
          preferred: Number.isFinite(payload.counts.preferred) ? payload.counts.preferred : 0,
          total: Number.isFinite(payload.counts.total) ? payload.counts.total : sourceUsers.value.length,
          trusted: Number.isFinite(payload.counts.trusted) ? payload.counts.trusted : 0,
          unknown: Number.isFinite(payload.counts.unknown) ? payload.counts.unknown : 0,
          withEvidence: Number.isFinite(payload.counts.withEvidence) ? payload.counts.withEvidence : 0,
        }
        : emptyCounts();
      checkedAt.value = payload?.checkedAt ?? null;
      total.value = Number.isFinite(payload?.total) ? payload.total : sourceUsers.value.length;
    } catch (error) {
      sourceUsers.value = [];
      counts.value = emptyCounts();
      checkedAt.value = null;
      total.value = 0;
      errorMessage.value = getErrorMessage(error, 'Failed to load source users');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    checkedAt,
    counts,
    errorMessage,
    isLoading,
    load,
    sourceUsers,
    total,
  };
}
