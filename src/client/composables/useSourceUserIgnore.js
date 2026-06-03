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
  applyIgnoredSourceUser as defaultApplyIgnoredSourceUser,
  fetchIgnoredSourceUsers as defaultFetchIgnoredSourceUsers,
  fetchSourceUserIgnoreSuggestions as defaultFetchSourceUserIgnoreSuggestions,
  removeIgnoredSourceUser as defaultRemoveIgnoredSourceUser,
} from '../lib/activity-api.js';

export function useSourceUserIgnore({
  applyIgnoredSourceUser = defaultApplyIgnoredSourceUser,
  fetchIgnoredSourceUsers = defaultFetchIgnoredSourceUsers,
  fetchSourceUserIgnoreSuggestions = defaultFetchSourceUserIgnoreSuggestions,
  removeIgnoredSourceUser = defaultRemoveIgnoredSourceUser,
} = {}) {
  const actionErrorMessage = ref('');
  const errorMessage = ref('');
  const ignoredSourceUsers = ref([]);
  const isApplying = ref(false);
  const isLoading = ref(false);
  const isRemoving = ref(false);
  const pendingUsername = ref('');
  const suggestions = ref([]);

  const ignoredCount = computed(() => ignoredSourceUsers.value.length);
  const suggestionCount = computed(() => suggestions.value.length);

  async function load() {
    isLoading.value = true;
    errorMessage.value = '';

    try {
      const [ignoredPayload, suggestionPayload] = await Promise.all([
        fetchIgnoredSourceUsers(),
        fetchSourceUserIgnoreSuggestions(),
      ]);
      ignoredSourceUsers.value = Array.isArray(ignoredPayload?.ignoredSourceUsers)
        ? ignoredPayload.ignoredSourceUsers
        : [];
      suggestions.value = Array.isArray(suggestionPayload?.suggestions)
        ? suggestionPayload.suggestions
        : [];
    } catch (error) {
      ignoredSourceUsers.value = [];
      suggestions.value = [];
      errorMessage.value = getErrorMessage(error, 'Failed to load ignored source users');
    } finally {
      isLoading.value = false;
    }
  }

  async function applyIgnore({ username, reason, suggestionSignals } = {}) {
    pendingUsername.value = typeof username === 'string' ? username : '';
    isApplying.value = true;
    actionErrorMessage.value = '';

    try {
      await applyIgnoredSourceUser({ reason, suggestionSignals, username });
      await load();
      return true;
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Failed to ignore source user');
      return false;
    } finally {
      isApplying.value = false;
      pendingUsername.value = '';
    }
  }

  async function removeIgnore(username) {
    pendingUsername.value = username;
    isRemoving.value = true;
    actionErrorMessage.value = '';

    try {
      await removeIgnoredSourceUser(username);
      await load();
      return true;
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Failed to remove ignored source user');
      return false;
    } finally {
      isRemoving.value = false;
      pendingUsername.value = '';
    }
  }

  return {
    actionErrorMessage,
    applyIgnore,
    errorMessage,
    ignoredCount,
    ignoredSourceUsers,
    isApplying,
    isLoading,
    isRemoving,
    load,
    pendingUsername,
    removeIgnore,
    suggestionCount,
    suggestions,
  };
}
