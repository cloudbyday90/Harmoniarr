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

import { computed } from 'vue';
import { useAsyncResource } from './useAsyncResource.js';
import { fetchMusicQueueReleases as defaultFetchMusicQueueReleases } from '../lib/acquisition-api.js';
import { buildMusicQueueSummaryCards, normalizeMusicQueueRelease } from '../lib/acquisition-pipeline-presentation.js';

export function useMusicQueue({
  fetchMusicQueueReleases = defaultFetchMusicQueueReleases,
  limit = 100,
  pollIntervalMs = 30000,
} = {}) {
  const resource = useAsyncResource({
    fallbackErrorMessage: 'Music Queue failed to load',
    fetcher: () => fetchMusicQueueReleases({ limit }),
    initialData: { pagination: { total: 0 }, releases: [], summary: { counts: {}, total: 0 } },
    pollIntervalMs,
    project: (payload) => ({
      checkedAt: payload?.checkedAt ?? null,
      pagination: payload?.pagination ?? { total: 0 },
      releases: Array.isArray(payload?.releases) ? payload.releases.map(normalizeMusicQueueRelease) : [],
      summary: payload?.summary ?? { counts: {}, total: 0 },
    }),
    revalidateOnFocus: true,
  });

  const releases = computed(() => resource.data.value.releases ?? []);
  const summaryCards = computed(() => buildMusicQueueSummaryCards(resource.data.value.summary));
  const totalCount = computed(() => resource.data.value.pagination?.total ?? releases.value.length);

  return {
    ...resource,
    releases,
    summaryCards,
    totalCount,
  };
}
