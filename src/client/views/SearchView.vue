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
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import ArtistCard from '../components/media/ArtistCard.vue';
import AddArtistModal from '../components/media/AddArtistModal.vue';
import ConfirmRequestModal from '../components/media/ConfirmRequestModal.vue';
import EmptyState from '../components/EmptyState.vue';
import ReleaseCard from '../components/media/ReleaseCard.vue';
import ReleaseDetailModal from '../components/media/ReleaseDetailModal.vue';
import { useArtistMonitoring } from '../composables/useArtistMonitoring.js';
import { useArtworkGridRoving } from '../composables/useArtworkGridRoving.js';
import { useAddArtistModal } from '../composables/useAddArtistModal.js';
import { useArtworkBatchResolve } from '../composables/useArtworkBatchResolve.js';
import { useNetworkSearchWorkflow } from '../composables/useNetworkSearchWorkflow.js';
import { useReleaseRequest } from '../composables/useReleaseRequest.js';
import { useRequestUsers } from '../composables/useRequestUsers.js';
import { useSearchMusicWorkflow } from '../composables/useSearchMusicWorkflow.js';
import { buildArtistDetailLocation } from '../lib/artist-detail-route.js';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  getPreferredReleaseArtwork,
} from '../lib/release-artwork-resolve.js';
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
  totalSizeForResponse,
} from '../lib/search-presentation.js';
import { sessionStore } from '../state/session.js';

const searchMode = ref('music');

const monitoring = useArtistMonitoring();
const { isMonitored, isMonitoring } = monitoring;

const {
  addArtistModalOpen,
  addArtistCandidate,
  addArtistErrorMessage,
  addArtistPolicyDefaults,
  openAddArtistModal,
  closeAddArtistModal,
  submitAddArtist,
} = useAddArtistModal({ monitoring });

const {
  isRequested,
  isRequesting,
  requestRelease,
} = useReleaseRequest();

const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');
const { users: requestForUsers, loadUsers: loadRequestForUsers } = useRequestUsers();

const { getResolved: getResolvedArtwork, resolve: resolveArtworkBatch } = useArtworkBatchResolve();

const addArtistCandidateArtwork = computed(() => {
  const id = addArtistCandidate.value?.id;
  return id ? getResolvedArtwork('musicbrainz_artist', id, 'artist_thumbnail') ?? null : null;
});

function handleAddArtist(artist) {
  openAddArtistModal(artist);
}

function handleAddArtistSubmit(policyForm) {
  return submitAddArtist(policyForm);
}

const musicWorkflow = useSearchMusicWorkflow({
  resolveArtworkFn: resolveArtworkBatch,
});

const networkWorkflow = useNetworkSearchWorkflow();
void networkWorkflow.refreshStatus();

const {
  hasMusicResults,
  hasMusicSearched,
  isMusicSearching,
  musicArtistResults,
  musicQuery,
  musicReleaseResults,
  musicResultCount,
  musicSearchError,
  runMusicSearch,
} = musicWorkflow;

const {
  hasNetworkSearched,
  isNetworkSearching,
  isProbingStatus,
  minimumFileCount,
  networkErrorMessage,
  networkQuery,
  refreshStatus,
  responseLimit,
  runNetworkSearch,
  searchMeta,
  slskdStatus,
  sortedResponses,
  totalFiles,
  totalResultBytes,
  destroy: destroyNetworkWorkflow,
  attachVisibilityListener: attachNetworkVisibility,
} = networkWorkflow;

function getReleaseArtwork(release) {
  return getPreferredReleaseArtwork(getResolvedArtwork, release);
}

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

const confirmModalOpen = ref(false);
const confirmRelease = ref(null);
const confirmError = ref(null);

function openConfirmModal(release) {
  confirmRelease.value = release;
  confirmError.value = null;
  confirmModalOpen.value = true;
  if (isAdmin.value) {
    void loadRequestForUsers();
  }
}

function closeConfirmModal() {
  if (!isRequesting(confirmRelease.value)) {
    confirmModalOpen.value = false;
    confirmRelease.value = null;
    confirmError.value = null;
  }
}

const confirmIsRequesting = computed(() =>
  (confirmRelease.value ? isRequesting(confirmRelease.value) : false),
);

const confirmIsRequested = computed(() =>
  (confirmRelease.value ? isRequested(confirmRelease.value) : false),
);

async function handleConfirmRequest({ requestedForUserId = null } = {}) {
  if (!confirmRelease.value) {
    return;
  }

  confirmError.value = null;
  const result = await requestRelease(confirmRelease.value, { requestedForUserId });
  if (result.ok) {
    confirmModalOpen.value = false;
    confirmRelease.value = null;
  } else if (!result.skipped) {
    confirmError.value = getErrorMessage(result.error, 'Request failed. Please try again.');
  }
}

const statusTone = computed(() => buildNetworkStatusTone(slskdStatus.value));
const statusLabel = computed(() => buildNetworkStatusLabel(slskdStatus.value, isProbingStatus.value));
const networkStateLabel = computed(() => buildNetworkSearchStateLabel(searchMeta.value?.state ?? ''));
const topPeer = computed(() => sortedResponses.value[0] ?? null);
const musicArtistCount = computed(() => musicArtistResults.value.length);
const musicReleaseCount = computed(() => musicReleaseResults.value.length);

// Roving tabindex over each card grid (one tab stop; arrows move focus).
const artistGridEl = useTemplateRef('artistGrid');
useArtworkGridRoving(() => artistGridEl.value, {
  cellSelector: '.hx-media-card__link-area',
  count: musicArtistCount,
});
const releaseGridEl = useTemplateRef('releaseGrid');
useArtworkGridRoving(() => releaseGridEl.value, {
  cellSelector: '.hx-media-card__link-area',
  count: musicReleaseCount,
});
const networkPeerCount = computed(() => sortedResponses.value.length);

const modeCards = computed(() => ([
  {
    body: 'Search MusicBrainz artists and releases with cached artwork ready for follow and request flows.',
    key: 'music',
    metric: hasMusicSearched.value ? `${musicResultCount.value} results` : 'Artist + release search',
    title: 'Catalog',
  },
  {
    body: 'Query the live network, rank responders, and inspect availability before you download.',
    key: 'network',
    metric: hasNetworkSearched.value ? formatPeerCountLabel(networkPeerCount.value) : 'Live peer search',
    title: 'Network',
  },
]));

const activeModeMeta = computed(() => {
  if (searchMode.value === 'network') {
    return {
      eyebrow: 'Live Network Search',
      helper: 'Tune response limits and peer filtering, then watch the result table fill as peers respond.',
      title: 'Interrogate the network without leaving the workspace',
    };
  }

  return {
    eyebrow: 'Catalog Search',
    helper: 'Search artists to follow and releases to request with shared artwork resolution across the results grid.',
    title: 'Build requests from metadata first',
  };
});

const musicSummaryCards = computed(() => ([
  {
    body: hasMusicResults.value
      ? 'Artist matches are ready for monitoring and detail navigation.'
      : 'Searches populate here once catalog results arrive.',
    label: 'Artists',
    value: String(musicArtistCount.value),
  },
  {
    body: hasMusicResults.value
      ? 'Release cards reuse shared artwork fallbacks before request actions.'
      : 'Release matches and artwork coverage appear after a search.',
    label: 'Releases',
    value: String(musicReleaseCount.value),
  },
  {
    body: hasMusicResults.value
      ? 'Artwork requests are batched across artists, releases, and release groups.'
      : 'Shared media services prepare artwork after results resolve.',
    label: 'Coverage',
    value: hasMusicResults.value ? 'Ready' : 'Waiting',
  },
]));

const networkSummaryCards = computed(() => ([
  {
    body: hasNetworkSearched.value
      ? 'Filtered by the current minimum file threshold.'
      : 'Peers appear after the first search dispatch.',
    label: 'Peers',
    value: formatPeerCountLabel(networkPeerCount.value),
  },
  {
    body: hasNetworkSearched.value
      ? 'Includes every file returned before client-side display filtering.'
      : 'File totals are aggregated across all responders.',
    label: 'Files',
    value: formatFileCountLabel(totalFiles.value),
  },
  {
    body: hasNetworkSearched.value
      ? 'Combined size estimate for the returned result set.'
      : 'Result volume is estimated as responses arrive.',
    label: 'Payload',
    value: formatBytes(totalResultBytes.value),
  },
]));

onMounted(() => attachNetworkVisibility());
onBeforeUnmount(() => destroyNetworkWorkflow());
</script>

<template>
  <section class="hx-page search-view">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Search</h1>
        <p class="hx-page-subtitle">Search the catalog or the network from one shared workspace.</p>
      </div>
    </header>

    <article class="hx-card search-stage">
      <div class="hx-card-body search-stage__body">
        <div class="search-stage__intro">
          <span class="search-stage__eyebrow">{{ activeModeMeta.eyebrow }}</span>
          <h2 class="search-stage__title">{{ activeModeMeta.title }}</h2>
          <p class="search-stage__copy">{{ activeModeMeta.helper }}</p>
          <div class="search-stage__signals">
            <span class="hx-pill" data-tone="info">{{ searchMode === 'music' ? 'Metadata-first workflow' : 'Peer-aware workflow' }}</span>
            <span class="hx-pill" :data-tone="statusTone">{{ statusLabel }}</span>
            <span v-if="searchMode === 'music'" class="hx-pill" data-tone="success">
              {{ isAdmin ? 'Admin request controls ready' : 'Requester-safe search flow' }}
            </span>
            <span v-else-if="isNetworkSearching" class="hx-pill" data-tone="warning">Polling live responses</span>
            <span v-else-if="networkStateLabel" class="hx-pill" data-tone="success">{{ networkStateLabel }}</span>
          </div>
        </div>

        <div class="search-mode-grid" role="tablist" aria-label="Search workspace modes">
          <button
            v-for="modeCard in modeCards"
            :key="modeCard.key"
            type="button"
            class="search-mode-card"
            :data-active="searchMode === modeCard.key ? 'true' : 'false'"
            :aria-label="modeCard.key === 'music' ? 'Use catalog mode' : 'Use network mode'"
            :aria-pressed="searchMode === modeCard.key"
            @click="searchMode = modeCard.key"
          >
            <span class="search-mode-card__metric">{{ modeCard.metric }}</span>
            <span class="search-mode-card__title">{{ modeCard.title }}</span>
            <span class="search-mode-card__body">{{ modeCard.body }}</span>
          </button>
        </div>

        <form
          v-if="searchMode === 'music'"
          class="search-command-form"
          role="search"
          @submit.prevent="runMusicSearch"
        >
          <label class="search-command-form__label" for="music-query">
            Search for artists or releases
          </label>
          <div class="search-command-form__row">
            <input
              id="music-query"
              v-model="musicQuery"
              class="hx-input search-command-form__input"
              type="search"
              placeholder="e.g. Radiohead, Discovery, The Bends..."
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
              {{ isMusicSearching ? 'Searching...' : 'Search' }}
            </button>
          </div>
        </form>

        <form
          v-else
          class="search-network-grid"
          role="search"
          @submit.prevent="runNetworkSearch"
        >
          <div class="search-network-field search-network-field--query">
            <label class="hx-field-label" for="network-query">Query</label>
            <input
              id="network-query"
              v-model="networkQuery"
              class="hx-input"
              type="search"
              placeholder="artist - album, song title, or filename fragment"
              :disabled="isNetworkSearching"
            />
          </div>
          <div class="search-network-field">
            <label class="hx-field-label" for="network-limit">Response limit</label>
            <input
              id="network-limit"
              v-model.number="responseLimit"
              class="hx-input"
              type="number"
              min="1"
              max="500"
              :disabled="isNetworkSearching"
            />
          </div>
          <div class="search-network-field">
            <label class="hx-field-label" for="network-min-files">Min files</label>
            <input
              id="network-min-files"
              v-model.number="minimumFileCount"
              class="hx-input"
              type="number"
              min="1"
              :disabled="isNetworkSearching"
            />
          </div>
          <div class="search-network-field search-network-field--actions">
            <button
              type="submit"
              class="hx-btn"
              data-variant="primary"
              :disabled="isNetworkSearching || !networkQuery.trim()"
            >
              {{ isNetworkSearching ? 'Searching...' : 'Search' }}
            </button>
            <button
              type="button"
              class="hx-btn"
              :disabled="isProbingStatus"
              @click="refreshStatus"
            >
              Refresh status
            </button>
          </div>
        </form>
      </div>
    </article>

    <template v-if="searchMode === 'music'">
      <section v-if="hasMusicSearched || isMusicSearching" class="search-summary-grid" aria-label="Catalog search summary">
        <article v-for="card in musicSummaryCards" :key="card.label" class="hx-card search-summary-card">
          <div class="hx-card-body">
            <span class="search-summary-card__label">{{ card.label }}</span>
            <strong class="search-summary-card__value">{{ card.value }}</strong>
            <p class="search-summary-card__body">{{ card.body }}</p>
          </div>
        </article>
      </section>

      <EmptyState
        v-if="musicSearchError"
        :title="formatMusicSearchError(musicSearchError)"
        body="Check your connection or try a different search term."
      >
        <template #icon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </template>
      </EmptyState>

      <EmptyState
        v-else-if="!hasMusicSearched"
        title="Search for an artist or release"
        :body="buildSearchPreSearchBody()"
      >
        <template #icon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
            <path d="M11 8v6M8 11h6" />
          </svg>
        </template>
      </EmptyState>

      <article v-else-if="isMusicSearching" class="hx-card search-loading-card" aria-live="polite" aria-busy="true">
        <div class="hx-card-body">
          <p class="search-loading-card__title">Searching catalog...</p>
          <p class="search-loading-card__body">Artists, releases, and shared artwork coverage are being resolved now.</p>
        </div>
      </article>

      <EmptyState
        v-else-if="!hasMusicResults"
        title="No results found"
        body="Try a different spelling or a broader search term."
      >
        <template #icon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
            <path d="M8 11h6" />
          </svg>
        </template>
      </EmptyState>

      <template v-else>
        <article v-if="musicArtistResults.length > 0" class="hx-card search-results-card">
          <header class="hx-card-header search-results-card__header">
            <div>
              <h2 class="hx-card-title">Artists</h2>
              <p class="hx-card-subtitle">Search matches ready for monitoring and artist detail navigation.</p>
            </div>
          </header>
          <div class="hx-card-body">
            <ul ref="artistGrid" class="hx-artwork-grid search-grid" role="list" aria-label="Artist search results">
              <li v-for="artist in musicArtistResults" :key="artist.id">
                <ArtistCard
                  :artist="artist"
                  :monitored="isMonitored(artist.id)"
                  :monitoring="isMonitoring(artist.id)"
                  :to="artist.id ? buildArtistDetailLocation(artist.id, artist.name) : undefined"
                  :local-src="artist.id ? getResolvedArtwork('musicbrainz_artist', artist.id, 'artist_thumbnail')?.url ?? null : null"
                  :dominant-color="artist.id ? getResolvedArtwork('musicbrainz_artist', artist.id, 'artist_thumbnail')?.dominantColor ?? null : null"
                  :artwork-asset-id="artist.id ? getResolvedArtwork('musicbrainz_artist', artist.id, 'artist_thumbnail')?.assetId ?? null : null"
                  @monitor="handleAddArtist"
                />
              </li>
            </ul>
          </div>
        </article>

        <article v-if="musicReleaseResults.length > 0" class="hx-card search-results-card">
          <header class="hx-card-header search-results-card__header">
            <div>
              <h2 class="hx-card-title">Releases</h2>
              <p class="hx-card-subtitle">Release results reuse shared release and release-group artwork before request actions.</p>
            </div>
          </header>
          <div class="hx-card-body">
            <ul ref="releaseGrid" class="hx-artwork-grid search-grid" role="list" aria-label="Release search results">
              <li v-for="release in musicReleaseResults" :key="release.id">
                <ReleaseCard
                  :release="release"
                  :requested="isRequested(release)"
                  :requesting="isRequesting(release)"
                  :local-src="getReleaseArtwork(release)?.url ?? null"
                  :dominant-color="getReleaseArtwork(release)?.dominantColor ?? null"
                  :artwork-asset-id="getReleaseArtwork(release)?.assetId ?? null"
                  @request="openConfirmModal"
                  @detail="openDetailModal"
                />
              </li>
            </ul>
          </div>
        </article>
      </template>
    </template>

    <template v-else>
      <section class="search-summary-grid" aria-label="Network search summary">
        <article v-for="card in networkSummaryCards" :key="card.label" class="hx-card search-summary-card">
          <div class="hx-card-body">
            <span class="search-summary-card__label">{{ card.label }}</span>
            <strong class="search-summary-card__value">{{ card.value }}</strong>
            <p class="search-summary-card__body">{{ card.body }}</p>
          </div>
        </article>
      </section>

      <article v-if="topPeer" class="hx-card search-peer-highlight">
        <div class="hx-card-body">
          <div class="search-peer-highlight__header">
            <div>
              <span class="search-summary-card__label">Top responder</span>
              <h2 class="search-peer-highlight__identity">{{ topPeer.username }}</h2>
            </div>
            <span class="hx-pill" :data-tone="topPeer.hasFreeUploadSlot ? 'success' : 'warning'">
              {{ topPeer.hasFreeUploadSlot ? 'Free slot' : 'Queued' }}
            </span>
          </div>
          <div class="search-peer-highlight__stats">
            <span>{{ formatFileCountLabel(topPeer.fileCount ?? topPeer.files?.length ?? 0) }}</span>
            <span>{{ formatBytes(totalSizeForResponse(topPeer)) }}</span>
            <span>{{ formatSpeed(topPeer.uploadSpeed) }}</span>
          </div>
        </div>
      </article>

      <article v-if="networkErrorMessage" class="hx-card">
        <div class="hx-card-body">
          <span class="hx-pill" data-tone="danger">{{ formatNetworkSearchError(networkErrorMessage) }}</span>
        </div>
      </article>

      <article class="hx-card search-results-card">
        <header class="hx-card-header search-results-card__header">
          <div>
            <h2 class="hx-card-title">Results</h2>
            <p class="hx-card-subtitle">
              {{ formatPeerCountLabel(networkPeerCount) }}
              · {{ formatFileCountLabel(totalFiles) }}
              <span v-if="networkStateLabel"> · {{ networkStateLabel }}</span>
            </p>
          </div>
          <div v-if="isNetworkSearching" class="hx-card-actions">
            <span class="hx-pill" data-tone="warning">Polling...</span>
          </div>
        </header>

        <div v-if="!hasNetworkSearched && !isNetworkSearching" class="hx-card-body">
          <EmptyState
            title="Start a network search"
            :body="buildNetworkNoResultsBody()"
          >
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 8.5A14.6 14.6 0 0 1 12 6c3 0 5.7.9 8 2.5" />
                <path d="M6.5 12A10.6 10.6 0 0 1 12 10c2.2 0 4.1.6 5.5 2" />
                <path d="M9.5 15.5A6.4 6.4 0 0 1 12 15c1 0 1.8.2 2.5.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </template>
          </EmptyState>
        </div>

        <div v-else-if="!sortedResponses.length && !isNetworkSearching" class="hx-card-body">
          <div class="hx-empty search-empty-results">
            <p class="hx-empty-title">No results yet</p>
            <p class="hx-empty-copy">{{ buildNetworkNoResultsBody() }}</p>
          </div>
        </div>

        <div v-else class="hx-card-body is-flush">
          <div class="hx-table-scroll">
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

    <AddArtistModal
      :open="addArtistModalOpen"
      :artist="addArtistCandidate"
      :artwork="addArtistCandidateArtwork"
      :initial-policy="addArtistPolicyDefaults"
      :saving="addArtistCandidate ? isMonitoring(addArtistCandidate.id) : false"
      :error-message="addArtistErrorMessage"
      @close="closeAddArtistModal"
      @submit="handleAddArtistSubmit"
    />

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

.search-stage {
  overflow: hidden;
}

.search-stage__body {
  display: grid;
  gap: var(--hx-space-4);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--hx-accent-soft) 70%, transparent) 0%, transparent 52%),
    linear-gradient(180deg, color-mix(in srgb, var(--hx-bg-surface-muted) 76%, transparent) 0%, transparent 100%);
}

.search-stage__intro {
  display: grid;
  gap: var(--hx-space-2);
}

.search-stage__eyebrow {
  font-size: var(--hx-text-xs);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--hx-accent-strong);
}

.search-stage__title {
  margin: 0;
  font-size: clamp(1.45rem, 2vw, 2rem);
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: var(--hx-text-strong);
  max-width: 16ch;
}

.search-stage__copy {
  margin: 0;
  max-width: 64ch;
  font-size: var(--hx-text-base);
  color: var(--hx-text-muted);
}

.search-stage__signals {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

.search-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--hx-space-3);
}

.search-mode-card {
  display: grid;
  gap: var(--hx-space-2);
  text-align: left;
  min-height: 152px;
  width: 100%;
  padding: var(--hx-space-4);
  border-radius: var(--hx-radius-lg);
  border: 1px solid var(--hx-border);
  background: color-mix(in srgb, var(--hx-bg-surface) 88%, transparent);
  color: inherit;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.search-mode-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--hx-accent) 40%, var(--hx-border));
  box-shadow: var(--hx-shadow-sm);
}

.search-mode-card[data-active="true"] {
  border-color: color-mix(in srgb, var(--hx-accent) 70%, var(--hx-border));
  background: color-mix(in srgb, var(--hx-accent-soft) 36%, var(--hx-bg-surface));
  box-shadow: var(--hx-shadow-sm);
}

.search-mode-card__metric {
  font-size: var(--hx-text-xs);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--hx-text-muted);
}

.search-mode-card__title {
  font-size: var(--hx-text-lg);
  font-weight: 700;
  color: var(--hx-text-strong);
}

.search-mode-card__body {
  font-size: var(--hx-text-sm);
  line-height: 1.55;
  color: var(--hx-text-muted);
}

.search-command-form {
  display: grid;
  gap: var(--hx-space-2);
}

.search-command-form__label {
  font-size: var(--hx-text-sm);
  font-weight: 600;
  color: var(--hx-text-strong);
}

.search-command-form__row {
  display: flex;
  gap: var(--hx-space-2);
  align-items: center;
}

.search-command-form__input {
  flex: 1;
  min-width: 0;
}

.search-network-grid {
  display: grid;
  grid-template-columns: minmax(0, 2.2fr) repeat(2, minmax(132px, 0.8fr)) auto;
  gap: var(--hx-space-3);
  align-items: end;
}

.search-network-field {
  display: grid;
  gap: var(--hx-space-2);
}

.search-network-field--actions {
  display: flex;
  gap: var(--hx-space-2);
  align-items: center;
  justify-content: flex-end;
}

.search-summary-grid {
  display: grid;
  gap: var(--hx-space-3);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.search-summary-card__label {
  display: inline-block;
  margin-bottom: var(--hx-space-2);
  font-size: var(--hx-text-xs);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--hx-text-muted);
}

.search-summary-card__value {
  display: block;
  font-size: clamp(1.35rem, 1.5vw, 1.7rem);
  line-height: 1.05;
  color: var(--hx-text-strong);
}

.search-summary-card__body {
  margin: var(--hx-space-2) 0 0;
  font-size: var(--hx-text-sm);
  line-height: 1.55;
  color: var(--hx-text-muted);
}

.search-loading-card__title {
  margin: 0;
  font-size: var(--hx-text-base);
  font-weight: 700;
  color: var(--hx-text-strong);
}

.search-loading-card__body {
  margin: var(--hx-space-2) 0 0;
  color: var(--hx-text-muted);
}

.search-results-card__header {
  align-items: flex-start;
}

.search-grid {
  --hx-artwork-grid-min: 168px;
}

.search-grid .hx-media-card {
  cursor: default;
}

.search-peer-highlight__header {
  display: flex;
  justify-content: space-between;
  gap: var(--hx-space-3);
  align-items: flex-start;
  flex-wrap: wrap;
}

.search-peer-highlight__identity {
  margin: var(--hx-space-2) 0 0;
  font-size: var(--hx-text-xl);
  line-height: 1.05;
  color: var(--hx-text-strong);
}

.search-peer-highlight__stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-3);
  margin-top: var(--hx-space-3);
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.search-empty-results {
  padding-block: var(--hx-space-4);
}

@media (max-width: 960px) {
  .search-network-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-network-field--query {
    grid-column: 1 / -1;
  }

  .search-network-field--actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .search-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .search-mode-grid,
  .search-summary-grid,
  .search-network-grid {
    grid-template-columns: 1fr;
  }

  .search-command-form__row,
  .search-network-field--actions {
    flex-direction: column;
    align-items: stretch;
  }

  .search-grid {
    --hx-artwork-grid-min: 140px;
  }

  .search-stage__title {
    max-width: none;
  }
}
</style>
