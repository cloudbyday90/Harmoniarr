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

import { computed, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  blockActivitySourceUser as defaultBlockActivitySourceUser,
  fetchActivityBlocklist as defaultFetchActivityBlocklist,
  unblockActivitySourceUser as defaultUnblockActivitySourceUser,
} from '../lib/activity-api.js';

export function useSourceUserBlocklist({
  blockActivitySourceUser = defaultBlockActivitySourceUser,
  fetchActivityBlocklist = defaultFetchActivityBlocklist,
  unblockActivitySourceUser = defaultUnblockActivitySourceUser,
} = {}) {
  const actionErrorMessage = ref('');
  const blocklist = ref([]);
  const checkedAt = ref(null);
  const errorMessage = ref('');
  const isBlocking = ref(false);
  const isLoading = ref(false);
  const isUnblocking = ref(false);
  const pendingUsername = ref('');
  const total = ref(0);

  const blockedCount = computed(() => blocklist.value.length);

  async function load({ query } = {}) {
    isLoading.value = true;
    errorMessage.value = '';

    try {
      const payload = await fetchActivityBlocklist({ query });
      blocklist.value = Array.isArray(payload?.blockedSourceUsers) ? payload.blockedSourceUsers : [];
      checkedAt.value = payload?.checkedAt ?? null;
      total.value = Number.isFinite(payload?.total) ? payload.total : blocklist.value.length;
    } catch (error) {
      blocklist.value = [];
      checkedAt.value = null;
      total.value = 0;
      errorMessage.value = getErrorMessage(error, 'Failed to load blocklist');
    } finally {
      isLoading.value = false;
    }
  }

  async function blockUser({ operatorNotes, query, reason, username }) {
    isBlocking.value = true;
    actionErrorMessage.value = '';

    try {
      await blockActivitySourceUser({ operatorNotes, reason, username });
      await load({ query });
      return true;
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Failed to block source user');
      return false;
    } finally {
      isBlocking.value = false;
    }
  }

  async function unblockUser(username, { query } = {}) {
    pendingUsername.value = username;
    isUnblocking.value = true;
    actionErrorMessage.value = '';

    try {
      await unblockActivitySourceUser(username);
      await load({ query });
      return true;
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Failed to unblock source user');
      return false;
    } finally {
      isUnblocking.value = false;
      pendingUsername.value = '';
    }
  }

  return {
    actionErrorMessage,
    blockedCount,
    blocklist,
    blockUser,
    checkedAt,
    errorMessage,
    isBlocking,
    isLoading,
    isUnblocking,
    load,
    pendingUsername,
    total,
    unblockUser,
  };
}
