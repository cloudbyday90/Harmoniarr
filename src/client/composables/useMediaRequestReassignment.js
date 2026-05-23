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

import { ref, shallowRef } from 'vue';
import {
  fetchMediaRequestReassignmentHistory,
  reassignMediaRequest,
} from '../lib/library-api.js';
import { fetchUsers } from '../lib/users-api.js';

export function useMediaRequestReassignment({
  fetchHistoryFn = fetchMediaRequestReassignmentHistory,
  fetchUsersFn = fetchUsers,
  reassignFn = reassignMediaRequest,
} = {}) {
  const isLoadingHistory = ref(false);
  const historyError = ref('');
  const events = shallowRef([]);

  const eligibleUsers = ref([]);
  const isLoadingUsers = ref(false);
  const usersError = ref('');

  const isReassigning = ref(false);
  const reassignError = ref('');
  const reassignResult = ref(null);

  async function loadHistory({ mediaRequestId }) {
    isLoadingHistory.value = true;
    historyError.value = '';
    try {
      const payload = await fetchHistoryFn({ mediaRequestId });
      events.value = payload.events ?? [];
    } catch (error) {
      historyError.value = error instanceof Error ? error.message : 'Failed to load history';
    } finally {
      isLoadingHistory.value = false;
    }
  }

  async function loadEligibleUsers() {
    if (isLoadingUsers.value || eligibleUsers.value.length > 0) return;
    isLoadingUsers.value = true;
    usersError.value = '';
    try {
      const payload = await fetchUsersFn();
      eligibleUsers.value = (payload.users ?? [])
        .filter((u) => u.mediaRequestTarget?.eligible === true)
        .map((u) => ({ id: u.id, username: u.username, role: u.role ?? null }));
    } catch (error) {
      usersError.value = error instanceof Error ? error.message : 'Could not load users';
    } finally {
      isLoadingUsers.value = false;
    }
  }

  async function reassign({ mediaRequestId, newRequestedForUserId, reason }) {
    isReassigning.value = true;
    reassignError.value = '';
    reassignResult.value = null;
    try {
      const payload = await reassignFn({ mediaRequestId, newRequestedForUserId, reason });
      reassignResult.value = payload.mediaRequest ?? null;
      return reassignResult.value;
    } catch (error) {
      reassignError.value = error instanceof Error ? error.message : 'Reassignment failed';
      return null;
    } finally {
      isReassigning.value = false;
    }
  }

  function reset() {
    events.value = [];
    historyError.value = '';
    reassignError.value = '';
    reassignResult.value = null;
  }

  return {
    eligibleUsers,
    events,
    historyError,
    isLoadingHistory,
    isLoadingUsers,
    isReassigning,
    loadEligibleUsers,
    loadHistory,
    reassign,
    reassignError,
    reassignResult,
    reset,
    usersError,
  };
}
