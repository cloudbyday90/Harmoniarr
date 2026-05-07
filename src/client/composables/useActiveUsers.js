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

// Module-level cache so the user list is fetched at most once per page load.
let cachedUsers = null;
let fetchPromise = null;

export function useActiveUsers({ fetchUsersFn = fetchUsers } = {}) {
  const users = ref(cachedUsers ?? []);
  const isLoading = ref(!cachedUsers);
  const error = ref(null);

  if (!cachedUsers) {
    if (!fetchPromise) {
      fetchPromise = fetchUsersFn()
        .then((data) => {
          cachedUsers = (data.users ?? []).filter((u) => !u.isDisabled);
          fetchPromise = null;
          return cachedUsers;
        })
        .catch((err) => {
          fetchPromise = null;
          throw err;
        });
    }

    fetchPromise
      .then((resolved) => {
        users.value = resolved;
        isLoading.value = false;
      })
      .catch((err) => {
        error.value = err;
        isLoading.value = false;
      });
  }

  return { users, isLoading, error };
}

/** Clears the module-level cache. Intended for use in tests only. */
export function clearActiveUsersCache() {
  cachedUsers = null;
  fetchPromise = null;
}
