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
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DependencyStatusPanel from '../components/DependencyStatusPanel.vue';
import LibraryDiscoverySummaryPanel from '../components/LibraryDiscoverySummaryPanel.vue';
import LibraryReconciliationSummaryPanel from '../components/LibraryReconciliationSummaryPanel.vue';
import LibraryScanSummaryPanel from '../components/LibraryScanSummaryPanel.vue';
import LibraryWantedSummaryPanel from '../components/LibraryWantedSummaryPanel.vue';
import OnboardingSummaryPanel from '../components/OnboardingSummaryPanel.vue';
import { useLibraryDiscoverySummary } from '../composables/useLibraryDiscoverySummary.js';
import { useLibraryReconciliationSummary } from '../composables/useLibraryReconciliationSummary.js';
import { useLibraryScanSummary } from '../composables/useLibraryScanSummary.js';
import { useLibraryWantedSummary } from '../composables/useLibraryWantedSummary.js';
import { useOnboardingSummary } from '../composables/useOnboardingSummary.js';
import { useSystemOverview } from '../composables/useSystemOverview.js';

const route = useRoute();
const router = useRouter();

const {
  dependencyStatuses,
  errorMessage,
  isLoading,
  loadOverview,
  overview,
  pathCards,
  pathValidationSummary,
  statusPills,
} = useSystemOverview();
const {
  actionErrorMessage: libraryDiscoveryActionErrorMessage,
  errorMessage: libraryDiscoveryErrorMessage,
  isLoading: isLoadingLibraryDiscovery,
  isStarting: isStartingLibraryDiscovery,
  libraryDiscoverySummary,
  loadLibraryDiscoverySummary,
  startDiscoveryRun,
} = useLibraryDiscoverySummary();
const {
  actionErrorMessage,
  errorMessage: libraryScanErrorMessage,
  isLoading: isLoadingLibraryScan,
  isStarting: isStartingLibraryScan,
  libraryScanSummary,
  loadLibraryScanSummary,
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

const isSetupMode = computed(() => route.query.onboarding === 'setup');
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

async function dismissSetupMode() {
  const nextQuery = { ...route.query };
  delete nextQuery.onboarding;
  await router.replace({ query: nextQuery });
}

onMounted(() => {
  void loadOverview();
  void loadLibraryDiscoverySummary();
  void loadLibraryScanSummary();
  void loadLibraryReconciliationSummary();
  void loadLibraryWantedSummary();
  void loadOnboardingSummary();
});
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
      v-if="showLibraryScanSummary"
      :action-error-message="actionErrorMessage"
      :error-message="libraryScanErrorMessage"
      :is-loading="isLoadingLibraryScan"
      :is-setup-mode="isSetupMode"
      :is-starting="isStartingLibraryScan"
      :scan-summary="libraryScanSummary"
      @refresh="loadLibraryScanSummary"
      @start="startLibraryScan"
    />

    <LibraryReconciliationSummaryPanel
      v-if="showLibraryReconciliationSummary"
      :error-message="libraryReconciliationErrorMessage"
      :is-loading="isLoadingLibraryReconciliation"
      :summary-payload="libraryReconciliationSummary"
      @refresh="loadLibraryReconciliationSummary"
    />

    <LibraryDiscoverySummaryPanel
      :action-error-message="libraryDiscoveryActionErrorMessage"
      v-if="showLibraryDiscoverySummary"
      :error-message="libraryDiscoveryErrorMessage"
      :is-loading="isLoadingLibraryDiscovery"
      :is-starting="isStartingLibraryDiscovery"
      :summary-payload="libraryDiscoverySummary"
      @refresh="loadLibraryDiscoverySummary"
      @start="startDiscoveryRun"
    />

    <LibraryWantedSummaryPanel
      v-if="showLibraryWantedSummary"
      :error-message="libraryWantedErrorMessage"
      :is-loading="isLoadingLibraryWanted"
      :summary-payload="libraryWantedSummary"
      @refresh="loadLibraryWantedSummary"
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
      </section>

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
