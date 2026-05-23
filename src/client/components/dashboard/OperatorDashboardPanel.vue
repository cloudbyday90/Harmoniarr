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
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import OnboardingSummaryPanel from '../OnboardingSummaryPanel.vue';
import { useAsyncResource } from '../../composables/useAsyncResource.js';
import { useLibraryWantedReleases } from '../../composables/useLibraryWantedReleases.js';
import { useLibraryWantedSummary } from '../../composables/useLibraryWantedSummary.js';
import { useOnboardingSummary } from '../../composables/useOnboardingSummary.js';
import {
  fetchMediaRequests,
  fetchMediaRequestSummary,
} from '../../lib/library-api.js';
import {
  fulfillmentLabel,
  fulfillmentTone,
  requestHeadline,
} from '../../lib/operator-dashboard-presentation.js';
import { fetchSlskdDownloads } from '../../lib/slskd-search-api.js';

// ── Onboarding ──────────────────────────────────────────────────────────────
const {
  errorMessage: onboardingErrorMessage,
  isLoading: isLoadingOnboarding,
  loadOnboardingSummary,
  nextAction,
  steps,
  summary: onboardingSummary,
} = useOnboardingSummary();

// Show the setup panel whenever there are outstanding issues, or while the
// first load is in flight (shows a skeleton so operators aren't surprised by
// the panel appearing below the search widget after data arrives).
const showOnboardingSummary = computed(() => (onboardingSummary.value?.issueCount ?? 0) > 0);
const showOnboardingPanel = computed(() => showOnboardingSummary.value || isLoadingOnboarding.value);

// ── Requests ─────────────────────────────────────────────────────────────────
const mediaRequests = ref([]);
const requestSummary = ref(null);
const isLoadingRequests = ref(false);

async function loadRequests() {
  isLoadingRequests.value = true;
  try {
    const [summaryPayload, requestsPayload] = await Promise.all([
      fetchMediaRequestSummary({ scope: 'mine' }),
      fetchMediaRequests({ scope: 'mine' }),
    ]);
    requestSummary.value = summaryPayload;
    mediaRequests.value = requestsPayload.mediaRequests ?? [];
  } catch {
    // silent — stats row simply won't show
  } finally {
    isLoadingRequests.value = false;
  }
}

// ── Wanted releases ───────────────────────────────────────────────────────────
const wantedSummary = useLibraryWantedSummary();
const wantedReleases = useLibraryWantedReleases();

const displayWanted = computed(() => wantedReleases.wantedReleases.value.slice(0, 8));
const hasWanted = computed(() => wantedReleases.wantedReleases.value.length > 0);

// ── Downloads ─────────────────────────────────────────────────────────────────
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
  void loadOnboardingSummary();
  void loadRequests();
  void wantedSummary.loadLibraryWantedSummary();
  void wantedReleases.loadWantedReleases();
  void loadDownloads();
});
</script>

<template>
  <section class="hx-page hx-media-hub">

    <!-- Setup status — rendered first so operators see it immediately.
         Visible while the initial load is in flight (skeleton) and whenever
         there are outstanding setup issues.  Disappears once setup is clean. -->
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
      <article class="hx-stat-card" v-if="activeDownloadFiles.length > 0">
        <span class="hx-stat-label">Downloading</span>
        <span class="hx-stat-value">{{ activeDownloadFiles.length }}</span>
        <span class="hx-stat-meta">Active transfers from Soulseek</span>
      </article>
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
              <td>{{ release.releaseGroupType ?? '—' }}</td>
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
</style>
