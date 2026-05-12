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
import { computed, onBeforeUnmount, ref } from 'vue';
import ArtistCard from '../components/media/ArtistCard.vue';
import ConfirmRequestModal from '../components/media/ConfirmRequestModal.vue';
import ReleaseDetailModal from '../components/media/ReleaseDetailModal.vue';
import EmptyState from '../components/EmptyState.vue';
import ReleaseCard from '../components/media/ReleaseCard.vue';
import { useArtistMonitoring } from '../composables/useArtistMonitoring.js';
import { useReleaseRequest } from '../composables/useReleaseRequest.js';
import { useRequestUsers } from '../composables/useRequestUsers.js';
import { buildArtistDetailLocation } from '../lib/artist-detail-route.js';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  searchMusicBrainzArtists,
  searchMusicBrainzReleases,
} from '../lib/metadata-api.js';
import {
  buildNetworkNoResultsBody,
  buildNetworkSearchStateLabel,
  buildNetworkStatusLabel,
  buildNetworkStatusTone,
  buildSearchPreSearchBody,
  formatBytes,
  formatFileCountLabel,
  formatMusicSearchError,
  formatNetworkSearchError,
  formatPeerCountLabel,
  formatSpeed,
  sortNetworkResponses,
  totalSizeForResponse,
} from '../lib/search-presentation.js';
import {
  fetchSlskdSearchResponses,
  fetchSlskdSearchState,
  fetchSlskdStatus,
  startSlskdSearch,
} from '../lib/slskd-search-api.js';
import { sessionStore } from '../state/session.js';

// ── Search mode ──────────────────────────────────────────────────────────────

/** 'music' = MusicBrainz card search | 'network' = Soulseek peer search */
const searchMode = ref('music');

// ── Music search state ───────────────────────────────────────────────────────

const musicQuery = ref('');
const musicArtistResults = ref([]);
const musicReleaseResults = ref([]);
const isMusicSearching = ref(false);
const musicSearchError = ref('');
const hasMusicSearched = ref(false);

const {
  isMonitored,
  isMonitoring,
  monitorArtist,
} = useArtistMonitoring();

const {
  isRequested,
  isRequesting,
  requestRelease,
} = useReleaseRequest();

const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');
const { users: requestForUsers, loadUsers: loadRequestForUsers } = useRequestUsers();

// ── Release detail modal ─────────────────────────────────────────────────────

const detailModalOpen = ref(false);
const detailRelease = ref(null);

function openDetailModal(release) {
  detailRelease.value = release;
  detailModalOpen.value = true;
}

function closeDetailModal() {
  detailModalOpen.value = false;
  detailRelease.value = null;
}

// ── Confirm request modal ─────────────────────────────────────────────────────

const confirmModalOpen = ref(false);
const confirmRelease = ref(null);
const confirmError = ref(null);

function openConfirmModal(release) {
  confirmRelease.value = release;
  confirmError.value = null;
  confirmModalOpen.value = true;
  if (isAdmin.value) void loadRequestForUsers();
}

function closeConfirmModal() {
  if (!isRequesting(confirmRelease.value)) {
    confirmModalOpen.value = false;
    confirmRelease.value = null;
    confirmError.value = null;
  }
}

const confirmIsRequesting = computed(() =>
  confirmRelease.value ? isRequesting(confirmRelease.value) : false,
);

const confirmIsRequested = computed(() =>
  confirmRelease.value ? isRequested(confirmRelease.value) : false,
);

async function handleConfirmRequest({ requestedForUserId = null } = {}) {
  if (!confirmRelease.value) return;
  confirmError.value = null;
  const result = await requestRelease(confirmRelease.value, { requestedForUserId });
  if (result.ok) {
    confirmModalOpen.value = false;
    confirmRelease.value = null;
  } else if (!result.skipped) {
    confirmError.value = getErrorMessage(result.error, 'Request failed. Please try again.');
  }
}

// ── Music search ─────────────────────────────────────────────────────────────

async function runMusicSearch() {
  const trimmed = musicQuery.value.trim();
  if (!trimmed || isMusicSearching.value) return;

  musicSearchError.value = '';
  musicArtistResults.value = [];
  musicReleaseResults.value = [];
  isMusicSearching.value = true;
  hasMusicSearched.value = true;

  try {
    const [artistPayload, releasePayload] = await Promise.all([
      searchMusicBrainzArtists({ query: trimmed, limit: 10 }),
      searchMusicBrainzReleases({ artist: trimmed, release: trimmed, limit: 20 }),
    ]);
    musicArtistResults.value = artistPayload.search?.results ?? [];
    musicReleaseResults.value = releasePayload.search?.results ?? [];
  } catch (error) {
    musicSearchError.value = getErrorMessage(error, 'Search failed. Please try again.');
  } finally {
    isMusicSearching.value = false;
  }
}

// ── Soulseek / network search ────────────────────────────────────────────────

const networkQuery = ref('');
const responseLimit = ref(50);
const minimumFileCount = ref(1);
const isNetworkSearching = ref(false);
const networkErrorMessage = ref('');
const responses = ref([]);
const searchMeta = ref(null);
const slskdStatus = ref(null);
const isProbingStatus = ref(false);
let pollTimer = null;

async function refreshStatus() {
  isProbingStatus.value = true;
  try {
    slskdStatus.value = await fetchSlskdStatus();
  } catch (error) {
    slskdStatus.value = { state: 'error', message: error?.message ?? 'Unknown error' };
  } finally {
    isProbingStatus.value = false;
  }
}

refreshStatus();

const statusTone = computed(() => buildNetworkStatusTone(slskdStatus.value));

const statusLabel = computed(() => buildNetworkStatusLabel(slskdStatus.value, isProbingStatus.value));

const totalFiles = computed(() => {
  let total = 0;
  for (const response of responses.value) {
    if (typeof response.fileCount === 'number') total += response.fileCount;
    else if (Array.isArray(response.files)) total += response.files.length;
  }
  return total;
});

const sortedResponses = computed(() =>
  sortNetworkResponses(responses.value, { minimumFileCount: minimumFileCount.value }),
);

function clearPollTimer() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

async function pollResponses(searchId) {
  try {
    const next = await fetchSlskdSearchResponses({ searchId });
    responses.value = next;
    const state = await fetchSlskdSearchState({ searchId });
    searchMeta.value = state;
    const isComplete = state?.isComplete || state?.state === 'completed' || state?.state === 'cancelled';
    if (!isComplete) {
      pollTimer = setTimeout(() => pollResponses(searchId), 2000);
    } else {
      isNetworkSearching.value = false;
    }
  } catch (error) {
    networkErrorMessage.value = error?.message ?? 'Failed to poll search results';
    isNetworkSearching.value = false;
  }
}

async function runNetworkSearch() {
  const trimmed = networkQuery.value.trim();
  if (!trimmed || isNetworkSearching.value) return;
  clearPollTimer();
  networkErrorMessage.value = '';
  responses.value = [];
  searchMeta.value = null;
  isNetworkSearching.value = true;
  try {
    const search = await startSlskdSearch({
      query: trimmed,
      responseLimit: Number(responseLimit.value) || 50,
      filterResponses: true,
    });
    const searchId = search?.searchId ?? search?.id;
    if (!searchId) {
      throw new Error('slskd did not return a search identifier');
    }
    searchMeta.value = search;
    await pollResponses(searchId);
  } catch (error) {
    networkErrorMessage.value = error?.message ?? 'Failed to start search';
    isNetworkSearching.value = false;
  }
}

onBeforeUnmount(() => clearPollTimer());
</script>

<template>
  <section class="hx-page search-view">

    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Search</h1>
        <p class="hx-page-subtitle">Find music to request, or search the Soulseek network directly.</p>
      </div>
    </header>

    <!-- Mode switcher — plain toggle buttons; no ARIA tab pattern needed -->
    <div class="hx-tabbar search-tabs">
      <button
        type="button"
        class="hx-tab"
        :class="{ 'is-active': searchMode === 'music' }"
        :aria-pressed="searchMode === 'music'"
        @click="searchMode = 'music'"
      >
        Music
      </button>
      <button
        type="button"
        class="hx-tab"
        :class="{ 'is-active': searchMode === 'network' }"
        :aria-pressed="searchMode === 'network'"
        @click="searchMode = 'network'"
      >
        Network
      </button>
    </div>

    <!-- ── Music search tab ──────────────────────────────────────────────── -->
    <template v-if="searchMode === 'music'">

      <!-- Search form -->
      <form class="search-form" role="search" @submit.prevent="runMusicSearch">
        <label class="search-form-label" for="music-query">
          Search for artists or releases
        </label>
        <div class="search-form-row">
          <input
            id="music-query"
            v-model="musicQuery"
            class="hx-input search-form-input"
            type="search"
            placeholder="e.g. Radiohead, Discovery, The Bends…"
            autocomplete="off"
            :disabled="isMusicSearching"
            aria-label="Search for an artist or release"
          />
          <button
            type="submit"
            class="hx-btn"
            data-variant="primary"
            :disabled="isMusicSearching || !musicQuery.trim()"
            :aria-busy="isMusicSearching"
          >
            {{ isMusicSearching ? 'Searching…' : 'Search' }}
          </button>
        </div>
      </form>

      <!-- Error state -->
      <EmptyState
        v-if="musicSearchError"
        :title="formatMusicSearchError(musicSearchError)"
        body="Check your connection or try a different search term."
      >
        <template #icon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
        </template>
      </EmptyState>

      <!-- Pre-search empty state -->
      <EmptyState
        v-else-if="!hasMusicSearched"
        title="Search for an artist or release"
        :body="buildSearchPreSearchBody()">
      >
        <template #icon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/>
            <path d="m20 20-3.5-3.5"/>
            <path d="M11 8v6M8 11h6"/>
          </svg>
        </template>
      </EmptyState>

      <!-- Loading state -->
      <p v-else-if="isMusicSearching" class="search-loading" aria-live="polite" aria-busy="true">
        Searching…
      </p>

      <!-- No results -->
      <EmptyState
        v-else-if="hasMusicSearched && !isMusicSearching && musicArtistResults.length === 0 && musicReleaseResults.length === 0"
        title="No results found"
        body="Try a different spelling or a broader search term."
      >
        <template #icon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/>
            <path d="m20 20-3.5-3.5"/>
            <path d="M8 11h6"/>
          </svg>
        </template>
      </EmptyState>

      <template v-else-if="hasMusicSearched && !isMusicSearching">
        <!-- Artist results -->
        <section v-if="musicArtistResults.length > 0" class="search-results-section">
          <h2 class="search-results-heading">Artists</h2>
          <div class="hx-artwork-grid search-grid" aria-label="Artist search results">
            <ArtistCard
              v-for="artist in musicArtistResults"
              :key="artist.id"
              :artist="artist"
              :monitored="isMonitored(artist.id)"
              :monitoring="isMonitoring(artist.id)"
              :to="artist.id ? buildArtistDetailLocation(artist.id, artist.name) : undefined"
              @monitor="monitorArtist"
            />
          </div>
        </section>

        <!-- Release results -->
        <section v-if="musicReleaseResults.length > 0" class="search-results-section">
          <h2 class="search-results-heading">Releases</h2>
          <div class="hx-artwork-grid search-grid" aria-label="Release search results">
            <ReleaseCard
              v-for="release in musicReleaseResults"
              :key="release.id"
              :release="release"
              :requested="isRequested(release)"
              :requesting="isRequesting(release)"
              @request="openConfirmModal"
              @detail="openDetailModal"
            />
          </div>
        </section>
      </template>

    </template>

    <!-- ── Network search tab ────────────────────────────────────────────── -->
    <template v-else>

      <div class="network-status-bar">
        <span class="hx-pill" :data-tone="statusTone">{{ statusLabel }}</span>
        <button type="button" class="hx-btn" @click="refreshStatus" :disabled="isProbingStatus">
          Refresh status
        </button>
      </div>

      <article class="hx-card">
        <div class="hx-card-body">
          <form class="hx-form-row" @submit.prevent="runNetworkSearch">
            <div class="hx-field" style="flex: 3 1 320px;">
              <label class="hx-field-label" for="network-query">Query</label>
              <input
                id="network-query"
                class="hx-input"
                v-model="networkQuery"
                type="search"
                placeholder="artist - album, song title, or filename fragment"
                :disabled="isNetworkSearching"
              />
            </div>
            <div class="hx-field" style="flex: 0 1 140px;">
              <label class="hx-field-label" for="network-limit">Response limit</label>
              <input
                id="network-limit"
                class="hx-input"
                v-model.number="responseLimit"
                type="number"
                min="1"
                max="500"
                :disabled="isNetworkSearching"
              />
            </div>
            <div class="hx-field" style="flex: 0 1 140px;">
              <label class="hx-field-label" for="network-min-files">Min files</label>
              <input
                id="network-min-files"
                class="hx-input"
                v-model.number="minimumFileCount"
                type="number"
                min="1"
                :disabled="isNetworkSearching"
              />
            </div>
            <div class="hx-field" style="flex: 0 0 auto;">
              <button type="submit" class="hx-btn" data-variant="primary" :disabled="isNetworkSearching || !networkQuery.trim()">
                {{ isNetworkSearching ? 'Searching…' : 'Search' }}
              </button>
            </div>
          </form>
        </div>
      </article>

      <article v-if="networkErrorMessage" class="hx-card">
        <div class="hx-card-body">
          <span class="hx-pill" data-tone="danger">{{ formatNetworkSearchError(networkErrorMessage) }}</span>
        </div>
      </article>

      <article class="hx-card">
        <header class="hx-card-header">
          <div>
            <h2 class="hx-card-title">Results</h2>
            <p class="hx-card-subtitle">
              {{ formatPeerCountLabel(sortedResponses.length) }}
              · {{ formatFileCountLabel(totalFiles) }}
              <span v-if="searchMeta?.state"> · {{ buildNetworkSearchStateLabel(searchMeta.state) }}</span>
            </p>
          </div>
          <div class="hx-card-actions" v-if="isNetworkSearching">
            <span class="hx-pill" data-tone="warning">Polling…</span>
          </div>
        </header>

        <div class="hx-card-body is-flush">
          <div v-if="!sortedResponses.length && !isNetworkSearching" class="hx-empty">
            <p class="hx-empty-title">No results yet</p>
            <p class="hx-empty-copy">{{ buildNetworkNoResultsBody() }}</p>
          </div>

          <div v-else class="hx-table-scroll">
            <table class="hx-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th class="hx-table-num">Files</th>
                  <th class="hx-table-num">Total size</th>
                  <th class="hx-table-num">Upload speed</th>
                  <th class="hx-table-num">Queue</th>
                  <th>Slot</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="response in sortedResponses" :key="response.username">
                  <td>{{ response.username }}</td>
                  <td class="hx-table-num">{{ response.fileCount ?? response.files?.length ?? 0 }}</td>
                  <td class="hx-table-num">{{ formatBytes(totalSizeForResponse(response)) }}</td>
                  <td class="hx-table-num">{{ formatSpeed(response.uploadSpeed) }}</td>
                  <td class="hx-table-num">{{ response.queueLength ?? 0 }}</td>
                  <td>
                    <span class="hx-pill" :data-tone="response.hasFreeUploadSlot ? 'success' : 'warning'">
                      {{ response.hasFreeUploadSlot ? 'Free' : 'Busy' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

    </template>

    <!-- Confirm request modal (rendered outside tabs so it persists) -->
    <ConfirmRequestModal
      :open="confirmModalOpen"
      :release="confirmRelease"
      :loading="confirmIsRequesting"
      :requested="confirmIsRequested"
      :error-message="confirmError"
      :users="isAdmin ? requestForUsers : []"
      @confirm="handleConfirmRequest"
      @close="closeConfirmModal"
    />

    <!-- Release detail modal -->
    <ReleaseDetailModal
      v-if="detailRelease"
      :open="detailModalOpen"
      :release-group-mbid="detailRelease?.releaseGroup?.id ?? detailRelease?.releaseGroupId ?? ''"
      :release-title="detailRelease?.title ?? null"
      :artist-name="detailRelease?.artistCredit?.[0]?.artist?.name ?? detailRelease?.artistCredit ?? null"
      :release-year="detailRelease?.date ? String(detailRelease.date).slice(0, 4) : null"
      :prefer-release-mbid="detailRelease?.id ?? null"
      @close="closeDetailModal"
      @requested="closeDetailModal"
    />

  </section>
</template>

<style scoped>
.search-view {
  display: grid;
  gap: var(--hx-space-5);
  align-content: start;
}

.search-tabs {
  margin-bottom: calc(-1 * var(--hx-space-1));
}

.search-form {
  display: grid;
  gap: var(--hx-space-2);
}

.search-form-label {
  font-size: var(--hx-text-sm);
  font-weight: 600;
  color: var(--hx-text-strong);
}

.search-form-row {
  display: flex;
  gap: var(--hx-space-2);
  align-items: center;
}

.search-form-input {
  flex: 1;
  min-width: 0;
}

.search-loading {
  text-align: center;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  padding: var(--hx-space-6) 0;
}

.search-results-section {
  display: grid;
  gap: var(--hx-space-3);
}

.search-results-heading {
  margin: 0;
  font-size: var(--hx-text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--hx-text-muted);
}

.search-grid {
  --hx-artwork-grid-min: 160px;
}

/* Cards inside search should not use cursor:pointer for the whole card */
.search-grid .hx-media-card {
  cursor: default;
}

.network-status-bar {
  display: flex;
  gap: var(--hx-space-3);
  align-items: center;
  flex-wrap: wrap;
}

/* ── Mobile ─────────────────────────────────────────────────────────────── */

@media (max-width: 640px) {
  /*
   * The music search form row is: [input flex:1] [submit button].
   * On narrow screens the button compresses the input.  Stack them so
   * the input takes full width and the button sits below.
   */
  .search-form-row {
    flex-direction: column;
    align-items: stretch;
  }

  /*
   * .search-grid sets --hx-artwork-grid-min: 160px via scoped styles, which
   * wins over the global 640px rule due to scoped-attribute specificity.
   * Re-override here so two columns still render on narrow phones.
   */
  .search-grid {
    --hx-artwork-grid-min: 140px;
  }
}
</style>
