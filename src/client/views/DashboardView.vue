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
  statusPills,
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

function statusClass(status) {
  switch (status) {
    case 'healthy':
      return 'review-status-selected';
    case 'unavailable':
      return 'review-status-failed';
    default:
      return 'review-status-held';
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
  <section class="page-stack">
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

    <article class="panel-dark hero-card compact">
      <p class="eyebrow">{{ isSetupMode ? 'First login workspace' : 'Authenticated dashboard' }}</p>
      <h2>Runtime overview</h2>
      <p>
        {{ isSetupMode
          ? 'Continue setup with contextual next steps instead of a separate onboarding wizard.'
          : 'The authenticated dashboard now consumes the protected overview API.' }}
      </p>
      <div class="pill-row" v-if="statusPills.length">
        <div class="pill" v-for="pill in statusPills" :key="pill.label">
          <span>{{ pill.label }}</span>
          <strong>{{ pill.value }}</strong>
        </div>
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
      <section class="stats-grid">
        <article class="panel-light">
          <h3>Service</h3>
          <dl>
            <div><dt>Name</dt><dd>{{ overview.service.name }}</dd></div>
            <div><dt>Version</dt><dd>{{ overview.service.version }}</dd></div>
            <div><dt>Started</dt><dd>{{ overview.service.startedAt }}</dd></div>
          </dl>
        </article>
        <article class="panel-light">
          <h3>Database</h3>
          <dl>
            <div><dt>Name</dt><dd>{{ overview.database.name }}</dd></div>
            <div><dt>Applied migrations</dt><dd>{{ overview.database.appliedMigrations }}</dd></div>
            <div><dt>Pending migrations</dt><dd>{{ overview.database.pendingMigrations }}</dd></div>
          </dl>
        </article>
        <article class="panel-light" v-if="pathValidationSummary">
          <div class="section-header">
            <div>
              <h3>Path validation</h3>
              <p class="metadata-card-copy">{{ pathValidationSummary.message }}</p>
            </div>
            <span class="review-status-pill" :class="statusClass(pathValidationSummary.status)">
              {{ statusLabel(pathValidationSummary.status) }}
            </span>
          </div>
          <dl>
            <div><dt>Configured mappings</dt><dd>{{ pathValidationSummary.configuredDownloadMappings }}</dd></div>
            <div><dt>Checked</dt><dd>{{ pathValidationSummary.checkedAt ?? 'Not yet recorded' }}</dd></div>
          </dl>
        </article>
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
