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
import { fetchSystemOverview } from '../lib/system-api.js';

export function useSystemOverview({
  fetchOverview = fetchSystemOverview,
} = {}) {
  const overview = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);

  const statusPills = computed(() => {
    if (!overview.value) {
      return [];
    }

    return [
      { label: 'Service', value: overview.value.service.name },
      { label: 'Version', value: overview.value.service.version },
      { label: 'Discovery cadence', value: overview.value.discoveryHeartbeat?.intervalLabel ?? 'Unavailable' },
      { label: 'Pending migrations', value: String(overview.value.database.pendingMigrations) },
    ];
  });

  const pathCards = computed(() => overview.value?.paths ?? []);
  const pathValidationSummary = computed(() => {
    if (!overview.value?.pathValidation) {
      return null;
    }

    return {
      checkedAt: overview.value.pathValidation.checkedAt ?? null,
      configuredDownloadMappings: overview.value.pathValidation.configuredDownloadMappings ?? 0,
      message: overview.value.pathValidation.summary?.message ?? '',
      status: overview.value.pathValidation.summary?.status ?? 'unavailable',
    };
  });
  const dependencyStatuses = computed(() => overview.value?.dependencies ?? []);

  async function loadOverview() {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      overview.value = await fetchOverview();
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Overview failed');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    dependencyStatuses,
    errorMessage,
    isLoading,
    loadOverview,
    overview,
    pathCards,
    pathValidationSummary,
    statusPills,
  };
}
