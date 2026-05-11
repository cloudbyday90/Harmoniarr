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
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import OnboardingSummaryPanel from '../OnboardingSummaryPanel.vue';
import { useAsyncResource } from '../../composables/useAsyncResource.js';
import { useLibraryWantedReleases } from '../../composables/useLibraryWantedReleases.js';
import { useLibraryWantedSummary } from '../../composables/useLibraryWantedSummary.js';
import { useOnboardingSummary } from '../../composables/useOnboardingSummary.js';
import {
  createMediaRequest,
  fetchMediaRequests,
  fetchMediaRequestSummary,
} from '../../lib/library-api.js';
import {
  fulfillmentLabel,
  fulfillmentTone,
  releaseYear,
  requestHeadline,
} from '../../lib/operator-dashboard-presentation.js';
import { fetchSlskdDownloads } from '../../lib/slskd-search-api.js';
import { searchMusicBrainzReleases } from '../../lib/metadata-api.js';

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

// ── Search ────────────────────────────────────────────────────────────────────
const searchQuery = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
const searchError = ref('');
const requestingId = ref(null);
const requestedIds = ref(new Set());
const requestErrors = reactive({});

async function runSearch() {
  const q = searchQuery.value.trim();
  if (!q) return;
  isSearching.value = true;
  searchError.value = '';
  searchResults.value = [];
  try {
    const payload = await searchMusicBrainzReleases({ release: q, limit: 12 });
    searchResults.value = payload.search?.results ?? [];
  } catch (err) {
    searchError.value = err instanceof Error ? err.message : 'Search failed';
  } finally {
    isSearching.value = false;
  }
}

async function requestRelease(result) {
  const id = result.id;
  requestingId.value = id;
  delete requestErrors[id];
  try {
    await createMediaRequest({
      artistName: result.artist?.name ?? '',
      releaseTitle: result.title,
      requestKind: 'release',
    });
    requestedIds.value = new Set([...requestedIds.value, id]);
    await loadRequests();
  } catch (err) {
    requestErrors[id] = err instanceof Error ? err.message : 'Request failed';
  } finally {
    if (requestingId.value === id) requestingId.value = null;
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

    <!-- Request intake ──────────────────────────────────────────────────── -->
    <article class="hx-card hx-request-intake">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">What do you want to listen to?</h2>
          <p class="hx-card-subtitle">Search for a release, then request it directly.</p>
        </div>
      </header>
      <div class="hx-card-body">
        <form @submit.prevent="runSearch" class="hx-search-form">
          <div class="hx-search-row">
            <input
              id="req-search"
              class="hx-input hx-search-input"
              type="search"
              v-model="searchQuery"
              placeholder="Album title, artist, or both…"
              autocomplete="off"
              :disabled="isSearching"
            />
            <button
              type="submit"
              class="hx-btn"
              data-variant="primary"
              :disabled="isSearching || !searchQuery.trim()"
            >
              {{ isSearching ? 'Searching…' : 'Search' }}
            </button>
          </div>
          <p class="hx-search-error hx-pill" data-tone="danger" v-if="searchError">{{ searchError }}</p>
        </form>
        <div class="hx-search-links" v-if="!searchResults.length && !isSearching">
          <RouterLink :to="{ name: 'search' }" class="hx-link">Search Soulseek directly</RouterLink>
          <span class="hx-link-sep" aria-hidden="true">·</span>
          <RouterLink :to="{ name: 'request-music' }" class="hx-link">Advanced requests &amp; request history</RouterLink>
        </div>
      </div>

      <!-- Results ───────────────────────────────────────────────────────── -->
      <div class="hx-card-body hx-card-body--flush" v-if="searchResults.length > 0">
        <ul class="hx-result-list">
          <li class="hx-result-item" v-for="result in searchResults" :key="result.id">
            <div class="hx-result-meta">
              <span class="hx-result-artist">{{ result.artist?.name ?? '—' }}</span>
              <span class="hx-result-title">{{ result.title }}</span>
              <span class="hx-result-detail">
                <template v-if="releaseYear(result.date)">{{ releaseYear(result.date) }}</template>
                <template v-if="releaseYear(result.date) && result.releaseGroup?.primaryType"> · </template>
                <template v-if="result.releaseGroup?.primaryType">{{ result.releaseGroup.primaryType }}</template>
                <template v-if="result.country"> · {{ result.country }}</template>
              </span>
              <span v-if="requestErrors[result.id]" class="hx-result-error">{{ requestErrors[result.id] }}</span>
            </div>
            <div class="hx-result-action">
              <span v-if="requestedIds.has(result.id)" class="hx-pill" data-tone="success">Requested</span>
              <button
                v-else
                type="button"
                class="hx-btn"
                data-variant="primary"
                :disabled="requestingId === result.id"
                @click="requestRelease(result)"
              >
                {{ requestingId === result.id ? 'Requesting…' : 'Request' }}
              </button>
            </div>
          </li>
        </ul>
        <div class="hx-search-links hx-search-links--bottom">
          <RouterLink :to="{ name: 'search' }" class="hx-link">Search Soulseek directly</RouterLink>
          <span class="hx-link-sep" aria-hidden="true">·</span>
          <RouterLink :to="{ name: 'request-music' }" class="hx-link">Advanced requests &amp; request history</RouterLink>
        </div>
      </div>
    </article>

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

.hx-request-intake .hx-card-title {
  font-size: var(--hx-text-xl);
  font-weight: 600;
  letter-spacing: -0.015em;
}

.hx-search-form {
  display: grid;
  gap: var(--hx-space-3);
}

.hx-search-row {
  display: flex;
  gap: var(--hx-space-3);
  align-items: center;
}

.hx-search-input {
  flex: 1 1 0;
  min-width: 0;
}

.hx-search-error {
  margin: 0;
}

.hx-search-links {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  font-size: var(--hx-text-sm);
  padding-top: var(--hx-space-3);
}

.hx-search-links--bottom {
  padding: var(--hx-space-3) var(--hx-space-4);
  border-top: 1px solid var(--hx-border);
}

.hx-result-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.hx-result-item {
  display: flex;
  align-items: center;
  gap: var(--hx-space-4);
  padding: var(--hx-space-3) var(--hx-space-4);
  border-bottom: 1px solid var(--hx-border);
}

.hx-result-item:last-child {
  border-bottom: none;
}

.hx-result-meta {
  flex: 1 1 0;
  min-width: 0;
  display: grid;
  gap: var(--hx-space-1);
}

.hx-result-artist {
  font-size: var(--hx-text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--hx-accent-strong);
}

.hx-result-title {
  font-weight: 600;
  color: var(--hx-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hx-result-detail {
  font-size: var(--hx-text-xs);
  color: var(--hx-text-muted);
}

.hx-result-error {
  font-size: var(--hx-text-xs);
  color: var(--hx-tone-danger, #e53e3e);
}

.hx-result-action {
  flex-shrink: 0;
}

.hx-link {
  color: var(--hx-accent-strong);
  text-decoration: none;
  font-weight: 500;
}

.hx-link:hover {
  text-decoration: underline;
}

.hx-link-sep {
  color: var(--hx-text-faint);
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
