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
import { fetchUsers } from '../lib/users-api.js';

/**
 * Composable that loads eligible request-target users for the "Request for"
 * operator selector in ConfirmRequestModal.
 *
 * Only meaningful when the current session user is an admin. The caller is
 * responsible for gating the call behind an admin check — this composable does
 * not enforce role requirements.
 *
 * `loadUsers` is idempotent: once users have been fetched successfully,
 * subsequent calls are no-ops. This makes it safe to call on each modal open
 * without incurring repeated network requests.
 *
 * @param {object} [options]
 * @param {function} [options.fetchUsersFn] - Override for testing.
 */
export function useRequestUsers({
  fetchUsersFn = fetchUsers,
} = {}) {
  /**
   * List of eligible request-target users.
   * Each item: { id: string, username: string, role: string }
   */
  const users = ref([]);

  /** Whether a user fetch is currently in progress. */
  const isLoading = ref(false);

  /** Error message from the last failed fetch, or empty string. */
  const errorMessage = ref('');

  /**
   * Load eligible request-target users from the server.
   *
   * Idempotent: skips the fetch if users are already populated or a load is
   * already in flight.
   */
  async function loadUsers() {
    if (isLoading.value || users.value.length > 0) return;

    isLoading.value = true;
    errorMessage.value = '';

    try {
      const payload = await fetchUsersFn();
      users.value = (payload.users ?? [])
        .filter((u) => u.mediaRequestTarget?.eligible === true)
        .map((u) => ({
          id: u.id,
          username: u.username,
          role: u.role ?? null,
        }));
    } catch (error) {
      errorMessage.value = error instanceof Error
        ? error.message
        : 'Could not load users';
    } finally {
      isLoading.value = false;
    }
  }

  return {
    errorMessage,
    isLoading,
    loadUsers,
    users,
  };
}
