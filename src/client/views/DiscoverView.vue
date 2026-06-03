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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AddArtistModal from '../components/media/AddArtistModal.vue';
import DiscoverRecommendationsPanel from '../components/media/DiscoverRecommendationsPanel.vue';
import DiscoverSearchBar from '../components/media/DiscoverSearchBar.vue';
import DiscoverSearchResultsPanel from '../components/media/DiscoverSearchResultsPanel.vue';
import EmptyState from '../components/EmptyState.vue';
import { useArtistMonitoring } from '../composables/useArtistMonitoring.js';
import { useDiscoverArtistArtwork } from '../composables/useDiscoverArtistArtwork.js';
import { useDiscoverGraph } from '../composables/useDiscoverGraph.js';
import { useDiscoverSearch } from '../composables/useDiscoverSearch.js';
import { useMonitoredArtistSummaries } from '../composables/useMonitoredArtistSummaries.js';
import {
  loadSavedAddArtistPolicyForm,
  saveAddArtistPolicyForm,
} from '../lib/add-artist-policy.js';
import { buildArtistDetailLocation } from '../lib/artist-detail-route.js';
import {
  buildDiscoverMonitoredArtistNavAriaLabel,
  buildDiscoverMonitoredArtistsAriaLabel,
  buildDiscoverPageSubtitle,
  buildDiscoverPreSearchBody,
  buildDiscoverSearchErrorBody,
  buildRecommendationMeta,
  buildRecommendationProvenance,
  buildRecommendationSupport,
  buildSearchResultBadgeLabel,
  buildSearchResultBadgeTone,
  buildSearchResultMeta,
  buildSearchResultSupport,
  formatDiscoverSearchError,
  resolveDiscoverSearchPanelMode,
} from '../lib/discover-presentation.js';

const {
  hasSearched,
  isSearching,
  query,
  results,
  runSearch,
  searchError,
} = useDiscoverSearch();

const {
  artists: monitoredArtists,
  loadMonitoredArtistSummaries: loadMonitoredArtists,
  destroy: destroyMonitoredArtists,
} = useMonitoredArtistSummaries({ limit: 25 });

const {
  addArtistWithPolicy,
  isMonitored,
  isMonitoring,
} = useArtistMonitoring();

const {
  seeds,
  suggestions,
  isAnySeedLoading,
  hasSeeds,
  lastError: graphError,
  isSeed,
  addSeed,
  hydrateSeeds,
} = useDiscoverGraph();

const {
  getArtistArtwork,
  isResolvingArtistArtwork,
} = useDiscoverArtistArtwork({
  artistSources: [seeds, suggestions, results],
});

const addArtistModalOpen = ref(false);
const addArtistCandidate = ref(null);
const addArtistErrorMessage = ref('');
const addArtistPolicyDefaults = ref(loadSavedAddArtistPolicyForm());

// ── View models ──────────────────────────────────────────────────────────────
// The container assembles plain, presentation-ready objects so child panels
// stay free of business logic and the template stays declarative.

const monitoredChips = computed(() =>
  seeds.value.map((seed) => ({
    id: seed.id,
    name: seed.name,
    initial: seed.name?.trim()?.charAt(0)?.toUpperCase() ?? '?',
    artworkUrl: getArtistArtwork(seed.id)?.url ?? null,
    to: buildArtistLocation(seed),
    ariaLabel: buildDiscoverMonitoredArtistNavAriaLabel(seed.name),
  })),
);

const recommendationCards = computed(() =>
  suggestions.value.map((suggestion) => {
    const provenance = buildRecommendationProvenance(suggestion);
    const added = isAddedArtist(suggestion.id);
    return {
      id: suggestion.id,
      artist: { id: suggestion.id, name: suggestion.name },
      artwork: getArtistArtwork(suggestion.id),
      badge: provenance.label,
      badgeTone: provenance.tone,
      metaText: buildRecommendationMeta(suggestion),
      supportingText: buildRecommendationSupport(suggestion),
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
    hasSeeds: hasSeeds.value,
  }),
);

function openAddArtistModal(artist) {
  if (!artist?.id || isAddedArtist(artist.id)) {
    return;
  }

  addArtistCandidate.value = artist;
  addArtistErrorMessage.value = '';
  addArtistModalOpen.value = true;
}

function closeAddArtistModal() {
  if (addArtistCandidate.value && isMonitoring(addArtistCandidate.value.id)) {
    return;
  }

  addArtistModalOpen.value = false;
  addArtistCandidate.value = null;
  addArtistErrorMessage.value = '';
}

async function handleAddArtistSubmit(policyForm) {
  if (!addArtistCandidate.value) {
    return;
  }

  const artist = addArtistCandidate.value;
  addArtistErrorMessage.value = '';
  const result = await addArtistWithPolicy(artist, policyForm);
  if (result?.success) {
    if (result.policy.useAsDefault) {
      addArtistPolicyDefaults.value = saveAddArtistPolicyForm(result.policy);
    }
    await addSeed(artist);
    await loadMonitoredArtists();
    closeAddArtistModal();
  } else if (result?.error) {
    addArtistErrorMessage.value = result.error.message ?? 'Could not add artist. Please try again.';
  }
}

onMounted(async () => {
  await loadMonitoredArtists();
  await hydrateSeeds(monitoredArtists.value);
});

onBeforeUnmount(() => {
  destroyMonitoredArtists();
});

function isAddedArtist(artistId) {
  return isSeed(artistId) || isMonitored(artistId);
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
    />

    <header class="hx-page-header discover-header">
      <div class="discover-header__intro">
        <h1 class="hx-page-title">Discover</h1>
        <p class="hx-page-subtitle">{{ buildDiscoverPageSubtitle() }}</p>
      </div>

      <DiscoverSearchBar
        v-model="query"
        :is-searching="isSearching"
        @submit="runSearch"
      />

      <div class="discover-counts" role="list" aria-label="Discover summary">
        <span class="hx-pill" data-tone="success" role="listitem">{{ seeds.length }} monitored</span>
        <span class="hx-pill" data-tone="info" role="listitem">{{ suggestions.length }} recommended</span>
        <span class="hx-pill" role="listitem">{{ results.length }} results</span>
        <span v-if="isAnySeedLoading || isResolvingArtistArtwork" class="hx-pill" data-tone="warning" role="listitem">Refreshing</span>
      </div>
    </header>

    <DiscoverRecommendationsPanel
      v-if="hasSeeds"
      :chips="monitoredChips"
      :cards="recommendationCards"
      :is-loading="isAnySeedLoading"
      :error-message="graphError"
      :monitored-aria-label="buildDiscoverMonitoredArtistsAriaLabel()"
      @add="openAddArtistModal"
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

    <article v-else-if="searchPanelMode === 'searching'" class="hx-card discover-loading-card" role="status" aria-live="polite" aria-busy="true">
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
      @add="openAddArtistModal"
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
