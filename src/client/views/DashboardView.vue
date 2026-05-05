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
import OnboardingSummaryPanel from '../components/OnboardingSummaryPanel.vue';
import { useAsyncResource } from '../composables/useAsyncResource.js';
import { useLibraryWantedReleases } from '../composables/useLibraryWantedReleases.js';
import { useLibraryWantedSummary } from '../composables/useLibraryWantedSummary.js';
import { useOnboardingSummary } from '../composables/useOnboardingSummary.js';
import {
  createMediaRequest,
  fetchMediaRequests,
  fetchMediaRequestSummary,
} from '../lib/library-api.js';
import { fetchSlskdDownloads } from '../lib/slskd-search-api.js';

// ── Onboarding ──────────────────────────────────────────────────────────────
const {
  errorMessage: onboardingErrorMessage,
  isLoading: isLoadingOnboarding,
  loadOnboardingSummary,
  nextAction,
  steps,
  summary: onboardingSummary,
} = useOnboardingSummary();

const showOnboardingSummary = computed(() => (onboardingSummary.value?.issueCount ?? 0) > 0);

// ── Requests ─────────────────────────────────────────────────────────────────
const mediaRequests = ref([]);
const requestSummary = ref(null);
const isLoadingRequests = ref(false);
const requestErrorMessage = ref('');
const requestSuccessMessage = ref('');
const isSubmitting = ref(false);

const form = reactive({
  artistName: '',
  releaseTitle: '',
  requestKind: 'release',
});

const canSubmit = computed(() => (
  form.artistName.trim().length > 0 && form.releaseTitle.trim().length > 0
));

async function loadRequests() {
  isLoadingRequests.value = true;
  requestErrorMessage.value = '';
  try {
    const [summaryPayload, requestsPayload] = await Promise.all([
      fetchMediaRequestSummary({ scope: 'mine' }),
      fetchMediaRequests({ scope: 'mine' }),
    ]);
    requestSummary.value = summaryPayload;
    mediaRequests.value = requestsPayload.mediaRequests ?? [];
  } catch (error) {
    requestErrorMessage.value = error instanceof Error ? error.message : 'Could not load requests';
  } finally {
    isLoadingRequests.value = false;
  }
}

async function submitRequest() {
  isSubmitting.value = true;
  requestSuccessMessage.value = '';
  requestErrorMessage.value = '';
  try {
    const payload = await createMediaRequest({
      artistName: form.artistName,
      releaseTitle: form.releaseTitle,
      requestKind: form.requestKind,
    });
    requestSuccessMessage.value = payload.mediaRequest.requestState === 'already_exists'
      ? 'This release already exists in your library and has been added to your requests.'
      : 'Request submitted.';
    form.artistName = '';
    form.releaseTitle = '';
    await loadRequests();
  } catch (error) {
    requestErrorMessage.value = error instanceof Error ? error.message : 'Request failed';
  } finally {
    isSubmitting.value = false;
  }
}

function requestHeadline(request) {
  if (request.requestKind === 'track') return `${request.artistName} — ${request.trackTitle}`;
  if (request.requestKind === 'external_url') return request.sourceUrl;
  return `${request.artistName} — ${request.releaseTitle}`;
}

function fulfillmentTone(fulfillmentStatus) {
  switch (fulfillmentStatus?.tone) {
    case 'selected': return 'success';
    case 'failed': return 'danger';
    default: return 'info';
  }
}

function fulfillmentLabel(fulfillmentStatus) {
  return fulfillmentStatus?.label ?? 'Queued';
}

// ── Wanted releases ───────────────────────────────────────────────────────────
const wantedSummary = useLibraryWantedSummary();
const wantedReleases = useLibraryWantedReleases();

const displayWanted = computed(() => wantedReleases.wantedReleases.value.slice(0, 8));
const hasWanted = computed(() => wantedReleases.wantedReleases.value.length > 0);

// ── Downloads ─────────────────────────────────────────────────────────────────
const {
  data: downloadGroups,
  isLoading: isLoadingDownloads,
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

    <!-- Setup alert ─────────────────────────────────────────────────────── -->
    <OnboardingSummaryPanel
      v-if="showOnboardingSummary"
      :error-message="onboardingErrorMessage"
      :is-loading="isLoadingOnboarding"
      :is-setup-mode="false"
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
          <p class="hx-card-subtitle">Harmoniarr will find it on Soulseek and import it to your library.</p>
        </div>
      </header>
      <div class="hx-card-body">
        <form @submit.prevent="submitRequest" class="hx-request-form">
          <div class="hx-form-row">
            <div class="hx-field">
              <label class="hx-field-label" for="req-artist">Artist</label>
              <input
                id="req-artist"
                class="hx-input"
                type="text"
                v-model="form.artistName"
                placeholder="e.g. Radiohead"
                autocomplete="off"
              />
            </div>
            <div class="hx-field">
              <label class="hx-field-label" for="req-release">Album / Release</label>
              <input
                id="req-release"
                class="hx-input"
                type="text"
                v-model="form.releaseTitle"
                placeholder="e.g. OK Computer"
                autocomplete="off"
              />
            </div>
            <div class="hx-request-form-action">
              <button
                type="submit"
                class="hx-btn"
                data-variant="primary"
                :disabled="isSubmitting || !canSubmit"
              >
                {{ isSubmitting ? 'Requesting…' : 'Request' }}
              </button>
            </div>
          </div>
          <div class="hx-request-form-feedback" v-if="requestSuccessMessage || requestErrorMessage">
            <span v-if="requestSuccessMessage" class="hx-pill" data-tone="success">{{ requestSuccessMessage }}</span>
            <span v-if="requestErrorMessage" class="hx-pill" data-tone="danger">{{ requestErrorMessage }}</span>
          </div>
          <div class="hx-request-form-links">
            <RouterLink :to="{ name: 'search' }" class="hx-link">Search Soulseek directly</RouterLink>
            <span class="hx-link-sep" aria-hidden="true">·</span>
            <RouterLink :to="{ name: 'request-music' }" class="hx-link">Advanced requests &amp; request history</RouterLink>
          </div>
        </form>
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

.hx-request-form {
  display: grid;
  gap: var(--hx-space-3);
}

.hx-request-form .hx-form-row {
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--hx-space-3);
}

.hx-request-form-action {
  padding-top: 22px;
}

.hx-request-form-action .hx-btn {
  white-space: nowrap;
}

.hx-request-form-feedback {
  display: flex;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

.hx-request-form-links {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  font-size: var(--hx-text-sm);
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
