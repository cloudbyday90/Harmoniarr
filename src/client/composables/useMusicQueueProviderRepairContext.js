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

import { computed, readonly, toValue, watch } from 'vue';
import { useDependencyHealth } from './useDependencyHealth.js';
import { useSettingsSetupProgress } from './useSettingsSetupProgress.js';
import { buildMusicQueueProviderRepairNotice } from '../lib/music-queue-provider-repair-presentation.js';

export function useMusicQueueProviderRepairContext({
  enabled = true,
  useDependencyHealthFn = useDependencyHealth,
  useSettingsSetupProgressFn = useSettingsSetupProgress,
} = {}) {
  const dependencyHealth = useDependencyHealthFn();
  const setupProgress = useSettingsSetupProgressFn();
  const isEnabled = computed(() => Boolean(toValue(enabled)));
  const isLoading = computed(() => isEnabled.value && (
    dependencyHealth.isLoading.value || setupProgress.isLoading.value
  ));
  const notice = computed(() => {
    if (!isEnabled.value) return null;

    return buildMusicQueueProviderRepairNotice({
      dependencies: dependencyHealth.dependencies.value,
      setupProgress: setupProgress.progress.value,
    });
  });

  async function refreshProviderRepairContext() {
    if (!isEnabled.value) return;

    await Promise.all([
      dependencyHealth.loadDependencyHealth(),
      setupProgress.loadSetupProgress(),
    ]);
  }

  watch(isEnabled, (shouldLoad) => {
    if (shouldLoad) {
      void refreshProviderRepairContext();
    }
  }, { immediate: true });

  return {
    isLoading: readonly(isLoading),
    notice: readonly(notice),
    refreshProviderRepairContext,
  };
}
