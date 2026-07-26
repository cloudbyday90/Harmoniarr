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

import { readonly, ref } from 'vue';
import { fetchSettings as defaultFetchSettings } from '../lib/settings-api.js';
import { buildSettingsSetupProgress } from '../lib/settings-setup-progress.js';

export function useSettingsSetupProgress({
  fetchSettingsFn = defaultFetchSettings,
} = {}) {
  const isLoading = ref(false);
  const loadError = ref('');
  const progress = ref(buildSettingsSetupProgress());

  async function loadSetupProgress() {
    isLoading.value = true;
    loadError.value = '';

    try {
      progress.value = buildSettingsSetupProgress(await fetchSettingsFn());
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Could not load setup progress';
    } finally {
      isLoading.value = false;
    }
  }

  return {
    isLoading: readonly(isLoading),
    loadError: readonly(loadError),
    loadSetupProgress,
    progress: readonly(progress),
  };
}
