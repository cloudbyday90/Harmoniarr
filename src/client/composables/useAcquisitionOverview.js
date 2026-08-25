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

import { computed, toValue, watch } from 'vue';
import { fetchDownloaderQueue as defaultFetchDownloaderQueue } from '../lib/downloader-api.js';
import { isDownloaderProviderDisabled } from '../lib/downloader-presentation.js';
import { useAsyncResource } from './useAsyncResource.js';
import { useMusicQueue } from './useMusicQueue.js';

const DOWNLOADER_POLL_INTERVAL_MS = 5000;

/**
 * Composes the existing scoped Music Queue and admin-only Downloader reads for
 * the read-only Acquisition overview. It never performs a Downloader request
 * unless the caller has confirmed that the session is allowed to view it; the
 * server's admin check remains the authorization boundary.
 *
 * @param {{ canViewDownloader?: boolean | import('vue').Ref<boolean>, fetchDownloaderQueue?: typeof defaultFetchDownloaderQueue, musicQueueOptions?: object }} options
 */
export function useAcquisitionOverview({
  canViewDownloader = false,
  fetchDownloaderQueue = defaultFetchDownloaderQueue,
  musicQueueOptions = {},
} = {}) {
  const canViewDownloads = computed(() => Boolean(toValue(canViewDownloader)));
  const musicQueue = useMusicQueue(musicQueueOptions);
  const downloader = useAsyncResource({
    fetcher: () => (
      canViewDownloads.value
        ? fetchDownloaderQueue({ includeRemoved: false })
        : Promise.resolve(null)
    ),
    fallbackErrorMessage: 'Download progress could not be refreshed.',
    initialData: null,
    pollIntervalMs: DOWNLOADER_POLL_INTERVAL_MS,
    pollWhile: (queue) => canViewDownloads.value && !isDownloaderProviderDisabled(queue),
    project: (payload) => (payload && typeof payload === 'object' ? payload : null),
    revalidateOnFocus: true,
  });

  watch(canViewDownloads, (canView, previouslyCouldView) => {
    if (canView && !previouslyCouldView) {
      void downloader.load();
    }

    if (!canView && previouslyCouldView) {
      downloader.reset();
    }
  });

  const isLoading = computed(() => (
    musicQueue.isLoading.value
    || (canViewDownloads.value && downloader.isLoading.value)
  ));
  const isRevalidating = computed(() => (
    musicQueue.isRevalidating.value || downloader.isRevalidating.value
  ));

  async function refresh() {
    const reads = [musicQueue.load()];
    if (canViewDownloads.value) {
      reads.push(downloader.load());
    }
    await Promise.all(reads);
  }

  return {
    canViewDownloads,
    downloadErrorMessage: downloader.errorMessage,
    downloaderQueue: downloader.data,
    downloadIsLoading: downloader.isLoading,
    downloadIsRevalidating: downloader.isRevalidating,
    isLoading,
    isRevalidating,
    musicQueueErrorMessage: musicQueue.errorMessage,
    musicQueueIsLoading: musicQueue.isLoading,
    musicQueueIsRevalidating: musicQueue.isRevalidating,
    refresh,
    releases: musicQueue.releases,
  };
}
