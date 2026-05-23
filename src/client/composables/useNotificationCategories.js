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

import { computed, reactive } from 'vue';
import { useAccountPreferences } from './useAccountPreferences.js';
import { NOTIFICATION_CATEGORIES } from '../lib/notification-category-constants.js';
import { sessionStore } from '../state/session.js';

export function useNotificationCategories({
  useAccountPreferencesFn = useAccountPreferences,
  isAdminFn = () => sessionStore.state.user?.role === 'admin',
} = {}) {
  const {
    preferences,
    isLoading,
    errorMessage,
    loadPreferences,
    savePreferences,
  } = useAccountPreferencesFn();

  const notifPrefs = computed(() => preferences.value?.notificationPreferences ?? {});
  const isAdmin = computed(isAdminFn);
  const visibleCategories = computed(() => NOTIFICATION_CATEGORIES.filter((c) => !c.adminOnly || isAdmin.value));

  const pendingToggles = reactive({});

  function isPending(key) {
    return key in pendingToggles;
  }

  function getEffectiveValue(key) {
    if (key in pendingToggles) return pendingToggles[key];
    return notifPrefs.value[key] !== false;
  }

  async function toggleCategory(key) {
    const current = getEffectiveValue(key);
    pendingToggles[key] = !current;

    try {
      await savePreferences({
        notificationPreferences: {
          ...notifPrefs.value,
          ...pendingToggles,
        },
      });
      delete pendingToggles[key];
    } catch {
      delete pendingToggles[key];
    }
  }

  return {
    errorMessage,
    getEffectiveValue,
    isPending,
    isLoading,
    loadPreferences,
    toggleCategory,
    visibleCategories,
  };
}
