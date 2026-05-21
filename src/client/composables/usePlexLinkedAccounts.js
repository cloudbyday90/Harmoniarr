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
import { fetchPlexLinkedAccountsOverview as defaultFetchPlexLinkedAccountsOverview } from '../lib/users-api.js';

function emptyOverview() {
  return {
    checkedAt: null,
    conflictProfiles: [],
    importableProfiles: [],
    linkedUsers: [],
    ownerLink: { linked: false },
    previewLinkedProfiles: [],
    previewStatus: { code: 'plex_link_required', message: 'Connect a Plex owner account before previewing or repairing linked accounts.', state: 'owner_link_required' },
    summary: {
      acknowledgedStaleUsers: 0,
      conflictProfiles: 0,
      importableProfiles: 0,
      linkedUsers: 0,
      ownerLinked: false,
      previewLinkedProfiles: 0,
      repairRequiredUsers: 0,
      staleUsers: 0,
      unlinkBlockedUsers: 0,
      unlinkReadyUsers: 0,
    },
  };
}

export function usePlexLinkedAccounts({
  fetchPlexLinkedAccountsOverview = defaultFetchPlexLinkedAccountsOverview,
} = {}) {
  const errorMessage = ref('');
  const isLoading = ref(false);
  const overview = ref(emptyOverview());

  async function load() {
    isLoading.value = true;
    errorMessage.value = '';

    try {
      const payload = await fetchPlexLinkedAccountsOverview();
      overview.value = {
        ...emptyOverview(),
        ...payload,
      };
    } catch (error) {
      overview.value = emptyOverview();
      errorMessage.value = getErrorMessage(error, 'Failed to load Plex linked accounts');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    errorMessage,
    isLoading,
    load,
    overview,
  };
}
