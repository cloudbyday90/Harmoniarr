<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

<script setup>
import { computed, nextTick, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ArtworkSummaryPanel from '../components/ArtworkSummaryPanel.vue';
import ActivityFeedPanel from '../components/ActivityFeedPanel.vue';
import DependencyStatusPanel from '../components/DependencyStatusPanel.vue';
import HeartbeatSummaryPanel from '../components/HeartbeatSummaryPanel.vue';
import OperatorNotificationsPanel from '../components/OperatorNotificationsPanel.vue';
import ProviderStatusPanel from '../components/ProviderStatusPanel.vue';
import {
  buildDashboardRouteQuery,
  getDashboardRouteStateKey,
  normalizeDashboardRouteState,
} from '../lib/dashboard-route-state.js';
import { getArtworkMaintenanceStatusClass, getArtworkMaintenanceStatusLabel } from '../lib/artwork-maintenance-status.js';
import LibraryDiscoverySummaryPanel from '../components/LibraryDiscoverySummaryPanel.vue';
import LibraryReconciliationSummaryPanel from '../components/LibraryReconciliationSummaryPanel.vue';
import LibraryScanSummaryPanel from '../components/LibraryScanSummaryPanel.vue';
import LibraryWantedSummaryPanel from '../components/LibraryWantedSummaryPanel.vue';
import OnboardingSummaryPanel from '../components/OnboardingSummaryPanel.vue';
import { useArtworkSummary } from '../composables/useArtworkSummary.js';
import { useLibraryDiscoverySummary } from '../composables/useLibraryDiscoverySummary.js';
import { useLibraryReconciliationSummary } from '../composables/useLibraryReconciliationSummary.js';
import { useLibraryScanSummary } from '../composables/useLibraryScanSummary.js';
import { useLibraryWantedSummary } from '../composables/useLibraryWantedSummary.js';
import { useOnboardingSummary } from '../composables/useOnboardingSummary.js';
import { useSystemOverview } from '../composables/useSystemOverview.js';

const route = useRoute();
const router = useRouter();
const artworkMaintenancePanelHash = '#artwork-maintenance-panel';
const libraryDiscoveryPanelHash = '#library-discovery-panel';
const libraryScanPanelHash = '#library-scan-panel';

const {
  actionErrorMessage: artworkActionErrorMessage,
  artworkCleanupHistory,
  artworkSummary,
  errorMessage: artworkErrorMessage,
  inventory: artworkInventory,
  isLoading: isLoadingArtwork,
  isLoadingRunDetail: isLoadingArtworkRunDetail,
  isStarting: isStartingArtworkCleanup,
  latestRun: latestArtworkRun,
  loadArtworkSummary,
  recentRuns,
  runDetailErrorMessage: artworkRunDetailErrorMessage,
  selectArtworkCleanupRun,
  selectedRunDetail,
  selectedRunId,
  startArtworkCleanup,
  summary: artworkMaintenanceSummary,
} = useArtworkSummary();
const {
  artworkMaintenanceSummary: overviewArtworkMaintenanceSummary,
  activityFeedCheckedAt,
  activityFeedErrorMessage,
  activityFeedEntries,
  hasMoreActivityFeedEntries,
  dependencyStatuses,
  errorMessage,
  heartbeatSummaries,
  isLoading,
  isLoadingMoreActivityFeed,
  operatorNotificationCheckedAt,
  operatorNotificationCounts,
  operatorNotifications,
  loadMoreActivityFeed,
  loadOverview,
  overview,
  pathCards,
  pathValidationSummary,
  providerStatus,
} = useSystemOverview();
const {
  actionErrorMessage: libraryDiscoveryActionErrorMessage,
  currentRun: currentLibraryDiscoveryRun,
  errorMessage: libraryDiscoveryErrorMessage,
  isLoading: isLoadingLibraryDiscovery,
  isStarting: isStartingLibraryDiscovery,
  libraryDiscoverySummary,
  loadLibraryDiscoverySummary,
  runDetailErrorMessage: libraryDiscoveryRunDetailErrorMessage,
  selectedRunId: selectedLibraryDiscoveryRunId,
  startDiscoveryRun,
} = useLibraryDiscoverySummary();
const {
  actionErrorMessage,
  currentRun: currentLibraryScanRun,
  errorMessage: libraryScanErrorMessage,
  isLoading: isLoadingLibraryScan,
  isStarting: isStartingLibraryScan,
  libraryScanSummary,
  loadLibraryScanSummary,
  runDetailErrorMessage: libraryScanRunDetailErrorMessage,
  selectedRunId: selectedLibraryScanRunId,
  startLibraryScan,
} = useLibraryScanSummary();
const {
  errorMessage: libraryReconciliationErrorMessage,
  isLoading: isLoadingLibraryReconciliation,
  libraryReconciliationSummary,
  loadLibraryReconciliationSummary,
} = useLibraryReconciliationSummary();
const {
  errorMessage: onboardingErrorMessage,
  isLoading: isLoadingOnboarding,
  loadOnboardingSummary,
  nextAction,
  steps,
  summary,
} = useOnboardingSummary();
const {
  errorMessage: libraryWantedErrorMessage,
  isLoading: isLoadingLibraryWanted,
  libraryWantedSummary,
  loadLibraryWantedSummary,
} = useLibraryWantedSummary();

const dashboardRouteState = computed(() => normalizeDashboardRouteState(route.query));
const isSetupMode = computed(() => dashboardRouteState.value.onboardingMode === 'setup');
const showOnboardingSummary = computed(() => (
  isSetupMode.value || (summary.value?.issueCount ?? 0) > 0
));
const showLibraryScanSummary = computed(() => (
  isSetupMode.value
  || isLoadingLibraryScan.value
  || libraryScanErrorMessage.value.length > 0
  || libraryScanSummary.value?.summary?.status !== 'completed'
));
const showLibraryReconciliationSummary = computed(() => (
  isSetupMode.value
  || isLoadingLibraryReconciliation.value
  || libraryReconciliationErrorMessage.value.length > 0
  || (libraryReconciliationSummary.value?.fileCounts?.observed ?? 0) > 0
));
const showLibraryDiscoverySummary = computed(() => (
  isSetupMode.value
  || isLoadingLibraryDiscovery.value
  || libraryDiscoveryErrorMessage.value.length > 0
  || (libraryDiscoverySummary.value?.requestCounts?.totalRequests ?? 0) > 0
));
const showLibraryWantedSummary = computed(() => (
  isSetupMode.value
  || isLoadingLibraryWanted.value
  || libraryWantedErrorMessage.value.length > 0
  || (libraryWantedSummary.value?.monitoredArtistCount ?? 0) > 0
));
const showArtworkSummary = computed(() => (
  isSetupMode.value
  || isLoadingArtwork.value
  || artworkErrorMessage.value.length > 0
  || (artworkInventory.value?.unassignedAssetCount ?? 0) > 0
  || latestArtworkRun.value !== null
  || recentRuns.value.length > 0
  || artworkMaintenanceSummary.value?.status === 'ready'
));
const showOverviewArtworkMaintenance = computed(() => (
  Boolean(overviewArtworkMaintenanceSummary.value)
  && (isSetupMode.value || overviewArtworkMaintenanceSummary.value.status !== 'empty')
));

function statusLabel(status) {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'unavailable':
      return 'Unavailable';
    default:
      return 'Needs attention';
  }
}

function buildMergedDashboardRouteQuery(nextState) {
  const query = { ...route.query };
  delete query.artworkRunId;
  delete query.libraryDiscoveryRunId;
  delete query.libraryScanRunId;
  delete query.onboarding;

  return {
    ...query,
    ...buildDashboardRouteQuery({
      ...dashboardRouteState.value,
      ...nextState,
    }),
  };
}

async function replaceDashboardRouteState(nextState, { hash = route.hash } = {}) {
  const normalizedNextState = normalizeDashboardRouteState({
    ...dashboardRouteState.value,
    ...nextState,
  });

  if (
    getDashboardRouteStateKey(normalizedNextState) === getDashboardRouteStateKey(dashboardRouteState.value)
    && hash === route.hash
  ) {
    return;
  }

  await router.replace({
    hash,
    query: buildMergedDashboardRouteQuery(normalizedNextState),
  });
}

function scrollPanelIntoView(panelId) {
  if (typeof document === 'undefined') {
    return;
  }

  document.getElementById(panelId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

async function dismissSetupMode() {
  await replaceDashboardRouteState({ onboardingMode: '' });
}

async function handleSelectArtworkCleanupRun(runId, { focus = true } = {}) {
  await selectArtworkCleanupRun(runId);
  await replaceDashboardRouteState(
    { artworkRunId: runId ?? '' },
    { hash: focus ? artworkMaintenancePanelHash : route.hash },
  );

  if (focus) {
    await nextTick();
    scrollPanelIntoView('artwork-maintenance-panel');
  }
}

async function handleStartLibraryScan() {
  await replaceDashboardRouteState({ libraryScanRunId: '' }, { hash: libraryScanPanelHash });
  await startLibraryScan();
}

async function handleStartLibraryDiscoveryRun() {
  await replaceDashboardRouteState({ libraryDiscoveryRunId: '' }, { hash: libraryDiscoveryPanelHash });
  await startDiscoveryRun();
}

async function openArtworkMaintenanceFromOverview() {
  const runId = overviewArtworkMaintenanceSummary.value?.latestRunId ?? selectedRunId.value ?? '';

  if (runId) {
    await handleSelectArtworkCleanupRun(runId, { focus: true });
    return;
  }

  await replaceDashboardRouteState({}, { hash: artworkMaintenancePanelHash });
  await nextTick();
  scrollPanelIntoView('artwork-maintenance-panel');
}

onMounted(() => {
  void loadArtworkSummary({ preferredRunId: dashboardRouteState.value.artworkRunId || null });
  void loadOverview();
  void loadLibraryDiscoverySummary({ preferredRunId: dashboardRouteState.value.libraryDiscoveryRunId || null });
  void loadLibraryScanSummary({ preferredRunId: dashboardRouteState.value.libraryScanRunId || null });
  void loadLibraryReconciliationSummary();
  void loadLibraryWantedSummary();
  void loadOnboardingSummary();
});

watch(
  () => dashboardRouteState.value.artworkRunId,
  (nextRunId, previousRunId) => {
    if (nextRunId === previousRunId) {
      return;
    }

    if (!nextRunId) {
      if (selectedRunId.value !== null) {
        void loadArtworkSummary({ preferredRunId: null });
      }
      return;
    }

    if (nextRunId !== selectedRunId.value) {
      void selectArtworkCleanupRun(nextRunId);
    }

    void nextTick().then(() => scrollPanelIntoView('artwork-maintenance-panel'));
  },
);

watch(
  () => dashboardRouteState.value.libraryScanRunId,
  (nextRunId, previousRunId) => {
    if (nextRunId === previousRunId) {
      return;
    }

    if (!nextRunId) {
      if (selectedLibraryScanRunId.value !== null) {
        void loadLibraryScanSummary({ preferredRunId: null });
      }
      return;
    }

    void loadLibraryScanSummary({ preferredRunId: nextRunId });
    void nextTick().then(() => scrollPanelIntoView('library-scan-panel'));
  },
);

watch(
  () => dashboardRouteState.value.libraryDiscoveryRunId,
  (nextRunId, previousRunId) => {
    if (nextRunId === previousRunId) {
      return;
    }

    if (!nextRunId) {
      if (selectedLibraryDiscoveryRunId.value !== null) {
        void loadLibraryDiscoverySummary({ preferredRunId: null });
      }
      return;
    }

    void loadLibraryDiscoverySummary({ preferredRunId: nextRunId });
    void nextTick().then(() => scrollPanelIntoView('library-discovery-panel'));
  },
);
</script>

<template>
  <section class="hx-page page-stack">
    <OnboardingSummaryPanel
      v-if="showOnboardingSummary"
      :error-message="onboardingErrorMessage"
      :is-loading="isLoadingOnboarding"
      :is-setup-mode="isSetupMode"
      :next-action="nextAction"
      :steps="steps"
      :summary="summary"
      @dismiss="dismissSetupMode"
      @refresh="loadOnboardingSummary"
    />

    <LibraryScanSummaryPanel
      id="library-scan-panel"
      v-if="showLibraryScanSummary"
      :action-error-message="actionErrorMessage"
      :current-run="currentLibraryScanRun"
      :error-message="libraryScanErrorMessage"
      :is-loading="isLoadingLibraryScan"
      :is-setup-mode="isSetupMode"
      :is-starting="isStartingLibraryScan"
      :run-detail-error-message="libraryScanRunDetailErrorMessage"
      :scan-summary="libraryScanSummary"
      @refresh="loadLibraryScanSummary"
      @start="handleStartLibraryScan"
    />

    <LibraryReconciliationSummaryPanel
      v-if="showLibraryReconciliationSummary"
      :error-message="libraryReconciliationErrorMessage"
      :is-loading="isLoadingLibraryReconciliation"
      :summary-payload="libraryReconciliationSummary"
      @refresh="loadLibraryReconciliationSummary"
    />

    <LibraryDiscoverySummaryPanel
      id="library-discovery-panel"
      :action-error-message="libraryDiscoveryActionErrorMessage"
      :current-run="currentLibraryDiscoveryRun"
      v-if="showLibraryDiscoverySummary"
      :error-message="libraryDiscoveryErrorMessage"
      :is-loading="isLoadingLibraryDiscovery"
      :is-starting="isStartingLibraryDiscovery"
      :run-detail-error-message="libraryDiscoveryRunDetailErrorMessage"
      :summary-payload="libraryDiscoverySummary"
      @refresh="loadLibraryDiscoverySummary"
      @start="handleStartLibraryDiscoveryRun"
    />

    <LibraryWantedSummaryPanel
      v-if="showLibraryWantedSummary"
      :error-message="libraryWantedErrorMessage"
      :is-loading="isLoadingLibraryWanted"
      :summary-payload="libraryWantedSummary"
      @refresh="loadLibraryWantedSummary"
    />

    <ArtworkSummaryPanel
      id="artwork-maintenance-panel"
      v-if="showArtworkSummary"
      :action-error-message="artworkActionErrorMessage"
      :error-message="artworkErrorMessage"
      :is-loading="isLoadingArtwork"
      :is-loading-run-detail="isLoadingArtworkRunDetail"
      :is-starting="isStartingArtworkCleanup"
      :run-detail-error-message="artworkRunDetailErrorMessage"
      :run-history-payload="artworkCleanupHistory"
      :selected-run-detail-payload="selectedRunDetail"
      :selected-run-id="selectedRunId"
      :summary-payload="artworkSummary"
      @refresh="loadArtworkSummary"
      @select-run="handleSelectArtworkCleanupRun"
      @start="startArtworkCleanup"
    />

    <article class="hx-card hx-dashboard-header">
      <div class="hx-dashboard-header-row">
        <div>
          <p class="eyebrow">{{ isSetupMode ? 'First login workspace' : 'Operations dashboard' }}</p>
          <h2>Runtime overview</h2>
          <p class="hx-text-muted">
            {{ isSetupMode
              ? 'Continue setup with contextual next steps instead of a separate onboarding wizard.'
              : 'Live status pulled from the protected overview API.' }}
          </p>
        </div>
        <div class="hx-dashboard-header-actions">
          <button type="button" class="hx-btn" @click="loadOverview" :disabled="isLoading">
            {{ isLoading ? 'Refreshing…' : 'Refresh overview' }}
          </button>
        </div>
      </div>

      <div class="hx-stat-grid" v-if="overview">
        <article class="hx-stat-card">
          <span class="hx-stat-label">Service</span>
          <span class="hx-stat-value">{{ overview.service.name }}</span>
          <span class="hx-stat-meta">v{{ overview.service.version }}</span>
        </article>
        <article class="hx-stat-card">
          <span class="hx-stat-label">Pending migrations</span>
          <span class="hx-stat-value">{{ overview.database.pendingMigrations }}</span>
          <span class="hx-stat-meta">Applied {{ overview.database.appliedMigrations }}</span>
        </article>
        <article class="hx-stat-card" v-if="pathValidationSummary">
          <span class="hx-stat-label">Path validation</span>
          <span class="hx-stat-value">
            <span class="hx-pill" :data-tone="pathValidationSummary.status === 'healthy' ? 'success' : pathValidationSummary.status === 'unavailable' ? 'danger' : 'warning'">
              {{ statusLabel(pathValidationSummary.status) }}
            </span>
          </span>
          <span class="hx-stat-meta">{{ pathValidationSummary.configuredDownloadMappings }} mapping{{ pathValidationSummary.configuredDownloadMappings === 1 ? '' : 's' }}</span>
        </article>
        <article class="hx-stat-card" v-if="overview.discoveryHeartbeat">
          <span class="hx-stat-label">Discovery cadence</span>
          <span class="hx-stat-value">{{ overview.discoveryHeartbeat?.intervalLabel ?? '—' }}</span>
          <span class="hx-stat-meta">Library scans</span>
        </article>
        <article class="hx-stat-card" v-if="overview.importExecutionHeartbeat">
          <span class="hx-stat-label">Import cadence</span>
          <span class="hx-stat-value">{{ overview.importExecutionHeartbeat?.intervalLabel ?? '—' }}</span>
          <span class="hx-stat-meta">Apply runs</span>
        </article>
        <article class="hx-stat-card" v-if="overview.metadataRefreshHeartbeat">
          <span class="hx-stat-label">Metadata cadence</span>
          <span class="hx-stat-value">{{ overview.metadataRefreshHeartbeat?.intervalLabel ?? '—' }}</span>
          <span class="hx-stat-meta">MusicBrainz refresh</span>
        </article>
      </div>
    </article>

    <article class="panel-light" v-if="isLoading">
      <h3>Loading overview</h3>
      <p>Fetching the current runtime and database state.</p>
    </article>

    <article class="panel-light error-panel" v-else-if="errorMessage">
      <h3>Overview unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <template v-else-if="overview">
      <section class="stats-grid" v-if="showOverviewArtworkMaintenance">
        <article class="panel-light" v-if="showOverviewArtworkMaintenance">
          <div class="section-header">
            <div>
              <h3>Artwork maintenance</h3>
              <p class="metadata-card-copy">{{ overviewArtworkMaintenanceSummary.message }}</p>
            </div>
            <span class="review-status-pill" :class="getArtworkMaintenanceStatusClass(overviewArtworkMaintenanceSummary.status)">
              {{ getArtworkMaintenanceStatusLabel(overviewArtworkMaintenanceSummary.status) }}
            </span>
          </div>
          <dl>
            <div><dt>Eligible now</dt><dd>{{ overviewArtworkMaintenanceSummary.eligibleAssetCount }}</dd></div>
            <div><dt>Unassigned assets</dt><dd>{{ overviewArtworkMaintenanceSummary.unassignedAssetCount }}</dd></div>
            <div><dt>Latest run</dt><dd>{{ overviewArtworkMaintenanceSummary.latestRunStatus ?? 'Not yet recorded' }}</dd></div>
            <div><dt>Checked</dt><dd>{{ overviewArtworkMaintenanceSummary.checkedAt ?? 'Not yet recorded' }}</dd></div>
          </dl>
          <div class="library-scan-actions">
            <button type="button" class="review-reset-button" @click="openArtworkMaintenanceFromOverview">
              {{ overviewArtworkMaintenanceSummary.latestRunId ? 'Open latest run' : 'Open artwork maintenance' }}
            </button>
          </div>
        </article>
      </section>

      <HeartbeatSummaryPanel
        :heartbeats="heartbeatSummaries"
        @refresh="loadOverview"
      />

      <OperatorNotificationsPanel
        :checked-at="operatorNotificationCheckedAt"
        :counts="operatorNotificationCounts"
        :notifications="operatorNotifications"
        @refresh="loadOverview"
      />

      <ActivityFeedPanel
        :checked-at="activityFeedCheckedAt"
        :entries="activityFeedEntries"
        :error-message="activityFeedErrorMessage"
        :has-more="hasMoreActivityFeedEntries"
        :is-loading-more="isLoadingMoreActivityFeed"
        @load-more="loadMoreActivityFeed"
        @refresh="loadOverview"
      />

      <ProviderStatusPanel
        v-if="providerStatus"
        :provider-status="providerStatus"
        @refresh="loadOverview"
      />

      <DependencyStatusPanel
        :dependencies="dependencyStatuses"
        @refresh="loadOverview"
      />

      <article class="panel-light">
        <div class="section-header">
          <div>
            <p class="eyebrow">Container paths</p>
            <h3>Path contract</h3>
          </div>
          <button type="button" @click="loadOverview">Refresh</button>
        </div>
        <div class="path-grid">
          <article class="path-card" v-for="path in pathCards" :key="path.label">
            <p>{{ path.label }}</p>
            <strong>{{ path.value }}</strong>
            <span>{{ path.description }}</span>
          </article>
        </div>
      </article>
    </template>
  </section>
</template>

<style scoped>
.hx-dashboard-header {
  display: grid;
  gap: var(--hx-space-4);
  padding: var(--hx-space-5);
}

.hx-dashboard-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--hx-space-4);
  flex-wrap: wrap;
}

.hx-dashboard-header-row h2 {
  margin: 0;
  font-size: var(--hx-text-xl);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--hx-text-strong);
}

.hx-dashboard-header-row p {
  margin: var(--hx-space-1) 0 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.hx-dashboard-header-actions {
  display: flex;
  gap: var(--hx-space-2);
  align-items: center;
}

.hx-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--hx-space-3);
}
</style>