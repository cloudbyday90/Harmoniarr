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
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import AddArtistModal from '../components/media/AddArtistModal.vue';
import DiscoverRecommendationsPanel from '../components/media/DiscoverRecommendationsPanel.vue';
import DiscoverSearchBar from '../components/media/DiscoverSearchBar.vue';
import DiscoverSearchResultsPanel from '../components/media/DiscoverSearchResultsPanel.vue';
import EmptyState from '../components/EmptyState.vue';
import { useArtistMonitoring } from '../composables/useArtistMonitoring.js';
import { useAddArtistModal } from '../composables/useAddArtistModal.js';
import { useDiscoverArtistArtwork } from '../composables/useDiscoverArtistArtwork.js';
import { useDiscoverGraph } from '../composables/useDiscoverGraph.js';
import { useDiscoverSearch } from '../composables/useDiscoverSearch.js';
import { useDebouncedSearch } from '../composables/useDebouncedSearch.js';
import { useMonitoredArtistSummaries } from '../composables/useMonitoredArtistSummaries.js';
import { buildArtistDetailLocation } from '../lib/artist-detail-route.js';
import {
  buildDiscoverMonitoredArtistNavAriaLabel,
  buildDiscoverMonitoredArtistsAriaLabel,
  buildDiscoverPageSubtitle,
  buildDiscoverPreSearchBody,
  buildDiscoverSearchErrorBody,
  buildRecommendationExplanation,
  buildSearchResultBadgeLabel,
  buildSearchResultBadgeTone,
  buildSearchResultMeta,
  buildSearchResultSupport,
  formatDiscoverSearchError,
  resolveDiscoverSearchPanelMode,
} from '../lib/discover-presentation.js';
import { buildSearchStatusMessage } from '../lib/search-status-message.js';

const discoverSearch = useDiscoverSearch();
const {
  hasSearched,
  isSearching,
  query,
  results,
  searchError,
} = discoverSearch;

// Debounced typeahead over `query` (one request per ~quiet period, MusicBrainz
// rate-capped, with AbortController cancellation). `submit` is the press-enter
// fallback; typeahead dispatches automatically as the operator types.
const { submit: submitSearch } = useDebouncedSearch(discoverSearch);

const {
  artists: monitoredArtists,
  loadMonitoredArtistSummaries: loadMonitoredArtists,
  destroy: destroyMonitoredArtists,
} = useMonitoredArtistSummaries({ limit: 25 });

const monitoring = useArtistMonitoring();
const { isMonitored, isMonitoring } = monitoring;

const {
  addArtistModalOpen,
  addArtistCandidate,
  addArtistErrorMessage,
  addArtistPolicyDefaults,
  lastAddedArtistId,
  openAddArtistModal,
  closeAddArtistModal,
  submitAddArtist,
} = useAddArtistModal({ monitoring });

const {
  recommendationInputs,
  suggestions,
  isAnyRecommendationInputLoading,
  hasRecommendationInputs,
  lastError: graphError,
  isRecommendationInput,
  addRecommendationInput,
  hydrateRecommendationInputs,
} = useDiscoverGraph();

const {
  getArtistArtwork,
  isResolvingArtistArtwork,
} = useDiscoverArtistArtwork({
  artistSources: [recommendationInputs, suggestions, results],
});

// Ref to the recommendations panel so focus can return to a newly added artist's
// monitored artist chip once the add dialog closes. See
// `handleFocusReturnUnavailable`.
const recommendationsPanelRef = ref(null);

// ── View models ──────────────────────────────────────────────────────────────
// The container assembles plain, presentation-ready objects so child panels
// stay free of business logic and the template stays declarative.

const monitoredChips = computed(() =>
  recommendationInputs.value.map((input) => ({
    id: input.id,
    name: input.name,
    initial: input.name?.trim()?.charAt(0)?.toUpperCase() ?? '?',
    artworkUrl: getArtistArtwork(input.id)?.url ?? null,
    to: buildArtistLocation(input),
    ariaLabel: buildDiscoverMonitoredArtistNavAriaLabel(input.name),
  })),
);

const recommendationCards = computed(() =>
  suggestions.value.map((suggestion) => {
    const explanation = buildRecommendationExplanation(suggestion);
    const added = isAddedArtist(suggestion.id);
    return {
      id: suggestion.id,
      artist: { id: suggestion.id, name: suggestion.name },
      artwork: getArtistArtwork(suggestion.id),
      badge: explanation.provenance.label,
      badgeTone: explanation.provenance.tone,
      strengthLabel: explanation.strength.label,
      strengthTier: explanation.strength.tier,
      metaText: explanation.metaText,
      supportingText: explanation.supportingText,
      monitored: added,
      monitoring: isMonitoring(suggestion.id),
      disabled: added,
      to: buildArtistLocation(suggestion),
    };
  }),
);

const searchResultCards = computed(() =>
  results.value.map((artist) => {
    const added = isAddedArtist(artist.id);
    return {
      id: artist.id,
      artist,
      artwork: getArtistArtwork(artist.id),
      badge: buildSearchResultBadgeLabel(added),
      badgeTone: buildSearchResultBadgeTone(added),
      metaText: buildSearchResultMeta(artist),
      supportingText: buildSearchResultSupport(artist, added),
      monitored: added,
      monitoring: isMonitoring(artist.id),
      disabled: added,
      to: buildArtistLocation(artist),
    };
  }),
);

const searchPanelMode = computed(() =>
  resolveDiscoverSearchPanelMode({
    searchError: searchError.value,
    hasSearched: hasSearched.value,
    isSearching: isSearching.value,
    resultCount: results.value.length,
    hasRecommendationInputs: hasRecommendationInputs.value,
  }),
);

// Screen-reader announcement of completed typeahead searches (role="status" live
// region in the template). Quiet while a search is in flight / before any search
// so the region speaks once per completed search instead of on every keystroke.
const searchStatusMessage = computed(() =>
  buildSearchStatusMessage({
    count: results.value.length,
    isSearching: isSearching.value,
    hasSearched: hasSearched.value,
    searchError: searchError.value ? formatDiscoverSearchError(searchError.value) : '',
  }),
);

function openAddArtist(artist) {
  openAddArtistModal(artist, isAddedArtist);
}

async function handleAddArtistSubmit(policyForm) {
  await submitAddArtist(policyForm, {
    onAdded: (artist) => {
      // The artist is already persisted. Refresh recommendations and the
      // monitored list in the background — a slow or unavailable similar-artists
      // fetch must not keep the modal open.
      void addRecommendationInput(artist);
      void loadMonitoredArtists();
    },
  });
}

// When the add dialog closes and its invoking "Add" button is no longer
// focusable (it became disabled after the add), move focus to the newly added
// artist's monitored chip — the logical follow-on element per the W3C APG dialog
// pattern. Falls back to no-op if the chip is not yet rendered.
async function handleFocusReturnUnavailable() {
  const artistId = lastAddedArtistId.value;
  lastAddedArtistId.value = null;
  if (!artistId) {
    return;
  }
  await nextTick();
  recommendationsPanelRef.value?.focusMonitoredArtistChip?.(artistId);
}

onMounted(async () => {
  await loadMonitoredArtists();
  await hydrateRecommendationInputs(monitoredArtists.value);
});

onBeforeUnmount(() => {
  destroyMonitoredArtists();
});

function isAddedArtist(artistId) {
  return isRecommendationInput(artistId) || isMonitored(artistId);
}

function buildArtistLocation(artist) {
  return artist?.id ? buildArtistDetailLocation(artist.id, artist.name) : undefined;
}
</script>

<template>
  <section class="hx-page discover-view">
    <AddArtistModal
      :open="addArtistModalOpen"
      :artist="addArtistCandidate"
      :artwork="addArtistCandidate ? getArtistArtwork(addArtistCandidate.id) : null"
      :initial-policy="addArtistPolicyDefaults"
      :saving="addArtistCandidate ? isMonitoring(addArtistCandidate.id) : false"
      :error-message="addArtistErrorMessage"
      @close="closeAddArtistModal"
      @submit="handleAddArtistSubmit"
      @focus-return-unavailable="handleFocusReturnUnavailable"
    />

    <header class="hx-page-header discover-header">
      <div class="discover-header__intro">
        <h1 class="hx-page-title">Discover</h1>
        <p class="hx-page-subtitle">{{ buildDiscoverPageSubtitle() }}</p>
      </div>

      <DiscoverSearchBar
        v-model="query"
        :is-searching="isSearching"
        @submit="submitSearch"
      />

      <!-- Screen-reader live region: announces completed typeahead searches
           (empty/quiet mid-flight to avoid per-keystroke spam). -->
      <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ searchStatusMessage }}</p>

      <div class="discover-counts" role="list" aria-label="Discover summary">
        <span class="hx-pill" data-tone="success" role="listitem">{{ recommendationInputs.length }} monitored</span>
        <span class="hx-pill" data-tone="info" role="listitem">{{ suggestions.length }} recommended</span>
        <span class="hx-pill" role="listitem">{{ results.length }} results</span>
        <span v-if="isAnyRecommendationInputLoading || isResolvingArtistArtwork" class="hx-pill" data-tone="warning" role="listitem">Refreshing</span>
      </div>
    </header>

    <DiscoverRecommendationsPanel
      v-if="hasRecommendationInputs"
      ref="recommendationsPanelRef"
      :chips="monitoredChips"
      :cards="recommendationCards"
      :is-loading="isAnyRecommendationInputLoading"
      :error-message="graphError"
      :monitored-aria-label="buildDiscoverMonitoredArtistsAriaLabel()"
      :artwork-loading="isResolvingArtistArtwork"
      @add="openAddArtist"
    />

    <EmptyState
      v-if="searchPanelMode === 'error'"
      :title="formatDiscoverSearchError(searchError)"
      :body="buildDiscoverSearchErrorBody()"
      variant="discover"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </template>
    </EmptyState>

    <EmptyState
      v-else-if="searchPanelMode === 'pre-search'"
      title="Search for an artist to get started"
      :body="buildDiscoverPreSearchBody()"
      variant="discover"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
          <path d="M11 8v6M8 11h6" />
        </svg>
      </template>
    </EmptyState>

    <article v-else-if="searchPanelMode === 'searching'" class="hx-card discover-loading-card">
      <div class="hx-card-body">
        <p class="discover-loading-card__title">Searching artist catalog...</p>
        <p class="discover-loading-card__body">Matching artists and artwork coverage are being prepared for add actions.</p>
      </div>
    </article>

    <EmptyState
      v-else-if="searchPanelMode === 'empty'"
      title="No artists found"
      body="Try a different spelling or a broader search term."
      variant="discover"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
          <path d="M8 11h6" />
        </svg>
      </template>
    </EmptyState>

    <DiscoverSearchResultsPanel
      v-else-if="searchPanelMode === 'results'"
      :cards="searchResultCards"
      :artwork-loading="isResolvingArtistArtwork"
      @add="openAddArtist"
    />
  </section>
</template>

<style scoped>
.discover-view {
  display: grid;
  gap: var(--hx-space-5);
  align-content: start;
}

.discover-header {
  display: grid;
  gap: var(--hx-space-3);
}

.discover-header__intro {
  display: grid;
  gap: var(--hx-space-1);
}

.discover-counts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

.discover-loading-card__title {
  margin: 0;
  font-size: var(--hx-text-base);
  font-weight: 700;
  color: var(--hx-text-strong);
}

.discover-loading-card__body {
  margin: var(--hx-space-2) 0 0;
  color: var(--hx-text-muted);
}
</style>
