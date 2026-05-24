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
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import OnboardingSummaryPanel from '../OnboardingSummaryPanel.vue';
import { useAsyncResource } from '../../composables/useAsyncResource.js';
import { useLibraryWantedReleases } from '../../composables/useLibraryWantedReleases.js';
import { useLibraryWantedSummary } from '../../composables/useLibraryWantedSummary.js';
import { useMaintenanceLocks } from '../../composables/useMaintenanceLocks.js';
import { useOnboardingSummary } from '../../composables/useOnboardingSummary.js';
import { useOperationHistory } from '../../composables/useOperationHistory.js';
import { useOperatorRequests } from '../../composables/useOperatorRequests.js';
import { useReleaseRadar } from '../../composables/useReleaseRadar.js';
import { useShellHeartbeat } from '../../composables/useShellHeartbeat.js';
import {
  fulfillmentLabel,
  fulfillmentTone,
  requestHeadline,
} from '../../lib/operator-dashboard-presentation.js';
import {
  formatOperationRunStatusTone,
  formatOperationTimestampShort,
  groupOperationRunsForDisplay,
} from '../../lib/operation-run-presentation.js';
import { fetchSlskdDownloads } from '../../lib/slskd-search-api.js';
import { getRadarWindowLabel } from '../../lib/release-radar-normalization.js';

const HEARTBEAT_POLL = 30_000;
const OPERATIONS_POLL = 15_000;
const RADAR_POLL = 60_000;
const REQUESTS_POLL = 15_000;

// ── System health ────────────────────────────────────────────────────────────
const heartbeat = useShellHeartbeat({ pollIntervalMs: HEARTBEAT_POLL, revalidateOnFocus: true });

const healthTone = computed(() => {
  switch (heartbeat.status.value) {
    case 'healthy': return 'success';
    case 'degraded': return 'warning';
    case 'unavailable': return 'danger';
    default: return 'info';
  }
});

// ── Onboarding ───────────────────────────────────────────────────────────────
const {
  errorMessage: onboardingErrorMessage,
  isLoading: isLoadingOnboarding,
  loadOnboardingSummary,
  nextAction,
  steps,
  summary: onboardingSummary,
  destroy: destroyOnboarding,
  attachVisibilityListener: attachOnboardingVisibility,
} = useOnboardingSummary({ pollIntervalMs: REQUESTS_POLL, revalidateOnFocus: true });

const showOnboardingSummary = computed(() => (onboardingSummary.value?.issueCount ?? 0) > 0);
const showOnboardingPanel = computed(() => showOnboardingSummary.value || isLoadingOnboarding.value);

// ── Operations ───────────────────────────────────────────────────────────────
const operations = useOperationHistory({ pollIntervalMs: OPERATIONS_POLL, revalidateOnFocus: true });

const displayRunGroups = computed(() => {
  const runs = operations.runs.value ?? [];
  if (runs.length === 0) return [];
  return groupOperationRunsForDisplay(runs);
});

const hasAttentionRuns = computed(() => {
  const groups = displayRunGroups.value;
  const attention = groups.find((g) => g.id === 'needs-attention');
  return (attention?.runs?.length ?? 0) > 0;
});

// ── Maintenance locks ────────────────────────────────────────────────────────
const locks = useMaintenanceLocks();

// ── Requests ─────────────────────────────────────────────────────────────────
const {
  isLoading: isLoadingRequests,
  loadRequests,
  mediaRequests,
  requestSummary,
} = useOperatorRequests({ pollIntervalMs: REQUESTS_POLL, revalidateOnFocus: true });

// ── Wanted releases ──────────────────────────────────────────────────────────
const wantedSummary = useLibraryWantedSummary({ pollIntervalMs: REQUESTS_POLL, revalidateOnFocus: true });
const wantedReleases = useLibraryWantedReleases({ pollIntervalMs: REQUESTS_POLL, revalidateOnFocus: true });

const displayWanted = computed(() => wantedReleases.wantedReleases.value.slice(0, 8));
const hasWanted = computed(() => wantedReleases.wantedReleases.value.length > 0);

// ── Release radar ────────────────────────────────────────────────────────────
const radar = useReleaseRadar({ pollIntervalMs: RADAR_POLL, revalidateOnFocus: true });

const radarStrip = computed(() => [
  ...radar.recent.value.slice(0, 4),
  ...radar.upcoming.value.slice(0, 4),
].slice(0, 8));
const hasRadar = computed(() => radarStrip.value.length > 0);

const radarStripLabel = computed(() => {
  if (radar.hasRecent.value && radar.hasUpcoming.value) return 'New and upcoming releases';
  if (radar.hasRecent.value) return getRadarWindowLabel('recent', radar.windows.value.recentDays);
  return getRadarWindowLabel('upcoming', radar.windows.value.upcomingDays);
});

// ── Downloads ────────────────────────────────────────────────────────────────
const {
  data: downloadGroups,
  isLoading: _isLoadingDownloads,
  load: loadDownloads,
} = useAsyncResource({
  fetcher: () => fetchSlskdDownloads({ includeRemoved: false }),
  project: (payload) => (Array.isArray(payload) ? payload : []),
  initialData: [],
  pollIntervalMs: 8000,
  fallbackErrorMessage: 'Failed to load downloads',
});

const activeDownloadFiles = computed(() => {
  const out = [];
  for (const group of downloadGroups.value ?? []) {
    const username = group.username ?? '\u2014';
    for (const dir of group.directories ?? []) {
      for (const file of dir.files ?? []) {
        if (/InProgress|Queued|Initializing|Negotiating/i.test(file.state ?? '')) {
          out.push({ ...file, username });
        }
      }
    }
  }
  return out.slice(0, 8);
});

// ── Boot ──────────────────────────────────────────────────────────────────────
onMounted(() => {
  void heartbeat.refresh();
  void loadOnboardingSummary();
  void operations.loadOperationHistory({});
  void locks.loadLocks();
  void loadRequests();
  void wantedSummary.loadLibraryWantedSummary();
  void wantedReleases.loadWantedReleases();
  void radar.load();
  void loadDownloads();

  heartbeat.attachVisibilityListener();
  attachOnboardingVisibility();
  operations.attachVisibilityListener();
  wantedSummary.attachVisibilityListener();
  wantedReleases.attachVisibilityListener();
  radar.attachVisibilityListener();
});

onBeforeUnmount(() => {
  heartbeat.destroy();
  destroyOnboarding();
  operations.destroy();
  wantedSummary.destroy();
  wantedReleases.destroy();
  radar.destroy();
});
</script>

<template>
  <section class="hx-page hx-media-hub">

    <!-- Setup status -->
    <OnboardingSummaryPanel
      v-if="showOnboardingPanel"
      :error-message="onboardingErrorMessage"
      :is-loading="isLoadingOnboarding"
      :is-setup-mode="showOnboardingSummary"
      :next-action="nextAction"
      :steps="steps"
      :summary="onboardingSummary"
      @refresh="loadOnboardingSummary"
    />

    <!-- Stats row ───────────────────────────────────────────────────────── -->
    <section class="hx-stat-grid" v-if="requestSummary || wantedSummary.libraryWantedSummary.value">
      <article class="hx-stat-card">
        <span class="hx-stat-label">System</span>
        <span class="hx-stat-value">{{ heartbeat.label.value }}</span>
        <span class="hx-stat-meta">{{ heartbeat.detail.value }}</span>
      </article>
      <article class="hx-stat-card" v-if="heartbeat.activeJobs.value != null">
        <span class="hx-stat-label">Jobs</span>
        <span class="hx-stat-value">{{ heartbeat.activeJobs.value }}</span>
        <span class="hx-stat-meta">Active background jobs</span>
      </article>
      <article class="hx-stat-card" v-if="requestSummary">
        <span class="hx-stat-label">My requests</span>
        <span class="hx-stat-value">{{ requestSummary.counts?.totalRequests ?? 0 }}</span>
        <span class="hx-stat-meta">Total submitted</span>
      </article>
      <article class="hx-stat-card" v-if="requestSummary">
        <span class="hx-stat-label">Active</span>
        <span class="hx-stat-value">{{ requestSummary.fulfillmentCounts?.active ?? 0 }}</span>
        <span class="hx-stat-meta">Queued, downloading, or pending import</span>
      </article>
      <article class="hx-stat-card" v-if="wantedSummary.libraryWantedSummary.value">
        <span class="hx-stat-label">Missing</span>
        <span class="hx-stat-value">{{ wantedSummary.releaseCounts.value?.missing ?? 0 }}</span>
        <span class="hx-stat-meta">Monitored releases not yet acquired</span>
      </article>
      <article class="hx-stat-card" v-if="wantedSummary.libraryWantedSummary.value">
        <span class="hx-stat-label">Partial</span>
        <span class="hx-stat-value">{{ wantedSummary.releaseCounts.value?.partial ?? 0 }}</span>
        <span class="hx-stat-meta">Releases with gaps in the library</span>
      </article>
      <article class="hx-stat-card" v-if="locks.hasActiveLocks.value">
        <span class="hx-stat-label">Locks</span>
        <span class="hx-stat-value">{{ locks.activeLocks.value.length }}</span>
        <span class="hx-stat-meta">Active maintenance locks</span>
      </article>
      <article class="hx-stat-card" v-if="activeDownloadFiles.length > 0">
        <span class="hx-stat-label">Downloading</span>
        <span class="hx-stat-value">{{ activeDownloadFiles.length }}</span>
        <span class="hx-stat-meta">Active transfers from Soulseek</span>
      </article>
    </section>

    <!-- System health ───────────────────────────────────────────────────── -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">System health</h3>
          <p class="hx-card-subtitle">Dependency status and background service health.</p>
        </div>
        <div class="hx-card-actions">
          <span class="hx-pill" :data-tone="healthTone">{{ heartbeat.label.value }}</span>
        </div>
      </header>
      <div class="hx-card-body">
        <p>{{ heartbeat.detail.value }}</p>
      </div>
    </article>

    <!-- Operations ──────────────────────────────────────────────────────── -->
    <article class="hx-card" v-if="operations.runs.value?.length > 0 || operations.isLoadingHistory.value">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Operations</h3>
          <p class="hx-card-subtitle">Background operations across your library.</p>
        </div>
        <div class="hx-card-actions">
          <span v-if="hasAttentionRuns" class="hx-pill" data-tone="danger">Needs attention</span>
          <RouterLink :to="{ name: 'activity-operations' }" class="hx-btn">View all</RouterLink>
        </div>
      </header>

      <div class="hx-card-body" v-if="operations.isLoadingHistory.value && !operations.runs.value?.length">
        <div class="hx-skeleton-stack">
          <span class="hx-skeleton" v-for="i in 3" :key="i"></span>
        </div>
      </div>

      <div class="hx-card-body hx-card-body--flush" v-else-if="displayRunGroups.length > 0">
        <table class="hx-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Status</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in displayRunGroups" :key="group.id">
              <tr v-for="run in group.runs.slice(0, 5)" :key="run.runId">
                <td>{{ run.operationType }}</td>
                <td>
                  <span class="hx-pill" :data-tone="formatOperationRunStatusTone(run.status)">
                    {{ run.status }}
                  </span>
                </td>
                <td>{{ formatOperationTimestampShort(run.startedAt) }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </article>

    <!-- Maintenance locks ───────────────────────────────────────────────── -->
    <article class="hx-card" v-if="locks.hasActiveLocks.value || locks.isLoading.value">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Maintenance locks</h3>
          <p class="hx-card-subtitle">Active locks that prevent concurrent operations.</p>
        </div>
        <div class="hx-card-actions">
          <RouterLink :to="{ name: 'settings-recovery' }" class="hx-btn">Manage</RouterLink>
        </div>
      </header>

      <div class="hx-card-body" v-if="locks.isLoading.value && !locks.activeLocks.value.length">
        <div class="hx-skeleton-stack">
          <span class="hx-skeleton" v-for="i in 2" :key="i"></span>
        </div>
      </div>

      <div class="hx-card-body hx-card-body--flush" v-else-if="locks.activeLocks.value.length > 0">
        <table class="hx-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Reason</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lock in locks.activeLocks.value.slice(0, 5)" :key="lock.lockId">
              <td>{{ lock.lockType }}</td>
              <td>{{ lock.reason || '\u2014' }}</td>
              <td>{{ lock.expiresAt ?? 'Manual release' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <!-- Release radar ───────────────────────────────────────────────────── -->
    <section v-if="hasRadar || radar.isLoading.value" class="radar-section" aria-label="Release radar">
      <div class="radar-header">
        <h3 class="radar-title">{{ radarStripLabel }}</h3>
        <RouterLink :to="{ name: 'activity-releases' }" class="hx-btn">See all</RouterLink>
      </div>
      <div class="radar-strip-scroll">
        <div
          v-for="(release, index) in radarStrip"
          :key="release.metadataReleaseGroupId ?? index"
          class="radar-card"
        >
          <div class="radar-card-art" v-if="release.artworkUrl">
            <img :src="release.artworkUrl" :alt="release.title ?? 'Release artwork'" loading="lazy" />
          </div>
          <div class="radar-card-art radar-card-art--empty" v-else></div>
          <div class="radar-card-body">
            <p class="radar-card-title">{{ release.title ?? '\u2014' }}</p>
            <p class="radar-card-artist">{{ release.artistCredit ?? '' }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Recent requests ─────────────────────────────────────────────────── -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">My requests</h3>
          <p class="hx-card-subtitle" v-if="requestSummary">{{ requestSummary.summary?.message }}</p>
        </div>
        <div class="hx-card-actions">
          <RouterLink :to="{ name: 'request-music' }" class="hx-btn">All requests</RouterLink>
        </div>
      </header>

      <div class="hx-card-body" v-if="isLoadingRequests && mediaRequests.length === 0">
        <div class="hx-skeleton-stack">
          <span class="hx-skeleton" v-for="i in 3" :key="i"></span>
        </div>
      </div>

      <div class="hx-card-body hx-card-body--flush" v-else-if="mediaRequests.length > 0">
        <table class="hx-table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in mediaRequests.slice(0, 10)" :key="request.id">
              <td>{{ requestHeadline(request) }}</td>
              <td>
                <span class="hx-pill" :data-tone="fulfillmentTone(request.fulfillmentStatus)">
                  {{ fulfillmentLabel(request.fulfillmentStatus) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="hx-empty" v-else>
        <p class="hx-empty-title">No requests yet</p>
        <p class="hx-empty-copy">Use the form above to request your first release.</p>
      </div>
    </article>

    <!-- Wanted releases ─────────────────────────────────────────────────── -->
    <article class="hx-card" v-if="hasWanted || wantedReleases.isLoading.value">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Wanted</h3>
          <p class="hx-card-subtitle">Monitored releases not yet fully acquired.</p>
        </div>
        <div class="hx-card-actions">
          <RouterLink :to="{ name: 'missing' }" class="hx-btn">View all</RouterLink>
        </div>
      </header>

      <div class="hx-card-body" v-if="wantedReleases.isLoading.value && !hasWanted">
        <div class="hx-skeleton-stack">
          <span class="hx-skeleton" v-for="i in 4" :key="i"></span>
        </div>
      </div>

      <div class="hx-card-body hx-card-body--flush" v-else-if="hasWanted">
        <table class="hx-table">
          <thead>
            <tr>
              <th>Artist</th>
              <th>Release</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="release in displayWanted" :key="release.id">
              <td>{{ release.artistName }}</td>
              <td>
                {{ release.releaseTitle }}
                <span v-if="release.releaseDisambiguation" class="hx-text-muted"> ({{ release.releaseDisambiguation }})</span>
              </td>
              <td>{{ release.releaseGroupType ?? '\u2014' }}</td>
              <td>
                <span class="hx-pill" :data-tone="release.wantedStatus === 'missing' ? 'danger' : 'warning'">
                  {{ release.wantedStatus }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <!-- Active downloads ────────────────────────────────────────────────── -->
    <article class="hx-card" v-if="activeDownloadFiles.length > 0">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Active downloads</h3>
          <p class="hx-card-subtitle">Files currently transferring from Soulseek.</p>
        </div>
        <div class="hx-card-actions">
          <RouterLink :to="{ name: 'activity-downloads' }" class="hx-btn">Open downloads</RouterLink>
        </div>
      </header>
      <div class="hx-card-body hx-card-body--flush">
        <table class="hx-table">
          <thead>
            <tr>
              <th>User</th>
              <th>File</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in activeDownloadFiles" :key="file.id ?? file.filename">
              <td class="hx-table-mono">{{ file.username }}</td>
              <td class="hx-table-truncate">{{ file.filename?.split(/[/\\]/).pop() ?? file.filename }}</td>
              <td>
                <span class="hx-pill" data-tone="warning">{{ file.state?.split(',')[0] ?? 'Active' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

  </section>
</template>

<style scoped>
.hx-media-hub {
  display: grid;
  gap: var(--hx-space-5);
  align-content: start;
}

.hx-table-mono {
  font-family: var(--hx-font-mono);
  font-size: var(--hx-text-xs);
}

.hx-table-truncate {
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hx-text-muted {
  color: var(--hx-text-muted);
}

.radar-section {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-3);
}

.radar-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--hx-space-3);
}

.radar-title {
  font-size: var(--hx-text-base);
  font-weight: var(--hx-font-semibold, 600);
  margin: 0;
}

.radar-strip-scroll {
  display: flex;
  gap: var(--hx-space-4);
  overflow-x: auto;
  padding-bottom: var(--hx-space-1);
  scrollbar-width: thin;
}

.radar-card {
  flex: 0 0 160px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-2);
}

.radar-card-art {
  aspect-ratio: 1;
  border-radius: var(--hx-radius-md);
  overflow: hidden;
  background: var(--hx-bg-surface-sunken);
}

.radar-card-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.radar-card-art--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.radar-card-body {
  min-width: 0;
}

.radar-card-title {
  font-size: var(--hx-text-sm);
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radar-card-artist {
  font-size: var(--hx-text-xs);
  color: var(--hx-text-muted);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .radar-strip-scroll {
    scrollbar-width: none;
  }

  .radar-strip-scroll::-webkit-scrollbar {
    display: none;
  }

  .radar-card {
    flex: 0 0 140px;
  }
}
</style>
