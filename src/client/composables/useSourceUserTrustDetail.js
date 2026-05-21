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
import {
  fetchActivitySourceUserDetail as defaultFetchActivitySourceUserDetail,
  updateActivitySourceUserTrust as defaultUpdateActivitySourceUserTrust,
} from '../lib/activity-api.js';

export function useSourceUserTrustDetail({
  fetchActivitySourceUserDetail = defaultFetchActivitySourceUserDetail,
  updateActivitySourceUserTrust = defaultUpdateActivitySourceUserTrust,
} = {}) {
  const actionErrorMessage = ref('');
  const checkedAt = ref(null);
  const detail = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(false);
  const isSaving = ref(false);
  const selectedUsername = ref('');

  async function load(username) {
    selectedUsername.value = typeof username === 'string' ? username : '';

    if (!selectedUsername.value) {
      checkedAt.value = null;
      detail.value = null;
      errorMessage.value = '';
      return;
    }

    isLoading.value = true;
    errorMessage.value = '';

    try {
      const payload = await fetchActivitySourceUserDetail(selectedUsername.value);
      checkedAt.value = payload?.checkedAt ?? null;
      detail.value = payload?.sourceUser ?? null;
    } catch (error) {
      checkedAt.value = null;
      detail.value = null;
      errorMessage.value = getErrorMessage(error, 'Failed to load source user detail');
    } finally {
      isLoading.value = false;
    }
  }

  async function saveTrustState({ operatorNotes, reason, trustState }) {
    if (!selectedUsername.value) {
      return null;
    }

    isSaving.value = true;
    actionErrorMessage.value = '';

    try {
      const payload = await updateActivitySourceUserTrust(selectedUsername.value, {
        operatorNotes,
        reason,
        trustState,
      });
      detail.value = payload?.sourceUser ?? null;
      checkedAt.value = new Date().toISOString();
      return detail.value;
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Failed to update source user trust');
      return null;
    } finally {
      isSaving.value = false;
    }
  }

  return {
    actionErrorMessage,
    checkedAt,
    detail,
    errorMessage,
    isLoading,
    isSaving,
    load,
    saveTrustState,
    selectedUsername,
  };
}
