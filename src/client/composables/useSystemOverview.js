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

import { computed, readonly, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  fetchSystemOperatorNotifications,
  fetchSystemOverview,
} from '../lib/system-api.js';
import { useActivityFeedPagination } from './useActivityFeedPagination.js';

const emptyOperatorNotificationCounts = Object.freeze({
  actionable: 0,
  byCategory: {
    failure: 0,
    manual_intervention: 0,
    queued_work: 0,
    recovery: 0,
  },
  total: 0,
});

export function useSystemOverview({
  fetchActivityFeed,
  fetchOperatorNotifications = fetchSystemOperatorNotifications,
  fetchOverview = fetchSystemOverview,
  pollIntervalMs = 0,
  revalidateOnFocus = false,
} = {}) {
  const overview = ref(null);
  const operatorNotificationCheckedAt = ref(null);
  const operatorNotificationCounts = ref({ ...emptyOperatorNotificationCounts });
  const operatorNotifications = ref([]);
  const errorMessage = ref('');
  const hasActionableOperatorNotifications = computed(() => operatorNotificationCounts.value.actionable > 0);
  const isLoading = ref(true);
  const isRevalidating = ref(false);
  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;

  const feed = useActivityFeedPagination({
    fetchActivityFeed,
  });

  const statusPills = computed(() => {
    if (!overview.value) {
      return [];
    }

    return [
      { label: 'Service', value: overview.value.service.name },
      { label: 'Version', value: overview.value.service.version },
      { label: 'Discovery cadence', value: overview.value.discoveryHeartbeat?.intervalLabel ?? 'Unavailable' },
      { label: 'Import cadence', value: overview.value.importExecutionHeartbeat?.intervalLabel ?? 'Unavailable' },
      { label: 'Metadata cadence', value: overview.value.metadataRefreshHeartbeat?.intervalLabel ?? 'Unavailable' },
      { label: 'Pending migrations', value: String(overview.value.database.pendingMigrations) },
    ];
  });

  const heartbeatSummaries = computed(() => overview.value?.heartbeats ?? []);

  const metadataRefreshSummary = computed(() => {
    const heartbeat = heartbeatSummaries.value.find((entry) => entry.key === 'metadataRefresh');
    if (!heartbeat) {
      return null;
    }

    return {
      intervalLabel: heartbeat.intervalLabel ?? null,
      isPaused: heartbeat.status === 'paused',
      lastPauseCode: heartbeat.state?.lastPauseCode ?? null,
      lastPauseMessage: heartbeat.state?.lastPauseMessage ?? null,
      lastPauseProvider: heartbeat.lastPauseProvider ?? null,
      lastTickAt: heartbeat.lastTickAt ?? null,
      lastTriggeredAt: heartbeat.lastTriggeredAt ?? null,
      message: heartbeat.message,
      nextRetryAt: heartbeat.nextRetryAt ?? null,
      status: heartbeat.status,
      statusClass: heartbeat.status === 'error'
        ? 'review-status-failed'
        : heartbeat.status === 'running' || heartbeat.status === 'idle'
          ? 'review-status-selected'
          : 'review-status-held',
    };
  });

  const pathCards = computed(() => overview.value?.paths ?? []);

  const providerStatus = computed(() => {
    const providers = overview.value?.providers;
    if (!providers) {
      return null;
    }

    return {
      appleMusic: {
        configured: providers.appleMusic?.configured ?? false,
        keyIdConfigured: providers.appleMusic?.keyIdConfigured ?? false,
        privateKeyConfigured: providers.appleMusic?.privateKeyConfigured ?? false,
        provider: 'apple_music',
        storefront: providers.appleMusic?.storefront ?? 'us',
        teamIdConfigured: providers.appleMusic?.teamIdConfigured ?? false,
      },
      spotify: {
        linked: providers.spotify?.linked ?? false,
        scope: providers.spotify?.scope ?? null,
        tokenExpiresAt: providers.spotify?.tokenExpiresAt ?? null,
        updatedAt: providers.spotify?.updatedAt ?? null,
      },
      youtube: {
        linked: providers.youtube?.linked ?? false,
        scope: providers.youtube?.scope ?? null,
        tokenExpiresAt: providers.youtube?.tokenExpiresAt ?? null,
        updatedAt: providers.youtube?.updatedAt ?? null,
      },
    };
  });

  const artworkMaintenanceSummary = computed(() => {
    if (!overview.value?.artworkMaintenance) {
      return null;
    }

    return {
      checkedAt: overview.value.artworkMaintenance.checkedAt ?? null,
      eligibleAssetCount: overview.value.artworkMaintenance.eligibleAssetCount ?? 0,
      latestRunId: overview.value.artworkMaintenance.latestRunId ?? null,
      latestRunStatus: overview.value.artworkMaintenance.latestRunStatus ?? null,
      message: overview.value.artworkMaintenance.message ?? '',
      status: overview.value.artworkMaintenance.status ?? 'unknown',
      unassignedAssetCount: overview.value.artworkMaintenance.unassignedAssetCount ?? 0,
    };
  });
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

  function clearPollTimer() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll() {
    clearPollTimer();
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    if (destroyed) return;
    if (!overview.value) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await loadOverview();
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    void loadOverview().then(() => {
      if (!destroyed) schedulePoll();
    });
  }

  function destroy() {
    destroyed = true;
    clearPollTimer();
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  function attachVisibilityListener() {
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  async function loadOverview() {
    if (destroyed) return;
    errorMessage.value = '';

    const isRevalidation = hasLoaded;
    if (isRevalidation) {
      isRevalidating.value = true;
    } else {
      isLoading.value = true;
    }

    try {
      const [nextOverview, nextOperatorNotifications] = await Promise.all([
        fetchOverview(),
        fetchOperatorNotifications(),
      ]);

      overview.value = nextOverview;
      operatorNotificationCheckedAt.value = nextOperatorNotifications.checkedAt ?? null;
      operatorNotificationCounts.value = nextOperatorNotifications.counts ?? operatorNotificationCounts.value;
      operatorNotifications.value = nextOperatorNotifications.notifications ?? [];
      feed.reset(
        nextOverview?.activityFeed?.entries ?? [],
        nextOverview?.activityFeed?.checkedAt ?? null,
        nextOverview?.activityFeed?.pageInfo ?? undefined,
      );
      hasLoaded = true;
    } catch (error) {
      if (!isRevalidation) {
        overview.value = null;
        operatorNotificationCheckedAt.value = null;
        operatorNotificationCounts.value = { ...emptyOperatorNotificationCounts };
        operatorNotifications.value = [];
      }
      errorMessage.value = getErrorMessage(error, 'Overview failed');
    } finally {
      if (!destroyed) {
        isLoading.value = false;
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  return {
    artworkMaintenanceSummary,
    activityFeedCheckedAt: feed.checkedAt,
    activityFeedEntries: feed.entries,
    activityFeedErrorMessage: feed.errorMessage,
    activityFeedPageInfo: feed.pageInfo,
    attachVisibilityListener,
    dependencyStatuses,
    destroy,
    errorMessage,
    hasMoreActivityFeedEntries: feed.hasMore,
    hasActionableOperatorNotifications,
    heartbeatSummaries,
    isLoading,
    isLoadingMoreActivityFeed: feed.isLoadingMore,
    isRevalidating: readonly(isRevalidating),
    loadMoreActivityFeed: feed.loadMore,
    loadOverview,
    metadataRefreshSummary,
    operatorNotificationCheckedAt,
    operatorNotificationCounts,
    operatorNotifications,
    overview,
    pathCards,
    pathValidationSummary,
    providerStatus,
    statusPills,
  };
}
