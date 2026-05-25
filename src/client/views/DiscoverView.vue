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
import DiscoverArtistCard from '../components/media/DiscoverArtistCard.vue';
import EmptyState from '../components/EmptyState.vue';
import { useArtistMonitoring } from '../composables/useArtistMonitoring.js';
import { useDiscoverArtistArtwork } from '../composables/useDiscoverArtistArtwork.js';
import { useDiscoverGraph } from '../composables/useDiscoverGraph.js';
import { useDiscoverSearch } from '../composables/useDiscoverSearch.js';
import { useMonitoredArtists } from '../composables/useMonitoredArtists.js';
import { buildArtistDetailLocation } from '../lib/artist-detail-route.js';
import {
  buildDiscoverGraphSubtitle,
  buildDiscoverNoSimilarArtistsMessage,
  buildDiscoverPageSubtitle,
  buildDiscoverPreSearchBody,
  buildDiscoverSearchErrorBody,
  buildDiscoverSeedRemoveAriaLabel,
  buildDiscoverSeedsAriaLabel,
  formatDiscoverSearchError,
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
  loadMonitoredArtists,
  destroy: destroyMonitoredArtists,
} = useMonitoredArtists({ limit: 25 });

const {
  isMonitored,
  isMonitoring,
  monitorArtist,
} = useArtistMonitoring();

const {
  seeds,
  suggestions,
  isAnySeedLoading,
  hasSuggestions,
  hasSeeds,
  lastError: graphError,
  isSeed,
  addSeed,
  removeSeed,
} = useDiscoverGraph();

const {
  getArtistArtwork,
  isResolvingArtistArtwork,
} = useDiscoverArtistArtwork({
  artistSources: [seeds, suggestions, results],
});

async function handleMonitor(artist) {
  const result = await monitorArtist(artist);
  if (result?.success) {
    await addSeed(artist);
  }
}

onMounted(async () => {
  await loadMonitoredArtists();
  for (const artist of monitoredArtists.value) {
    await addSeed({ id: artist.id, name: artist.name });
  }
});

onBeforeUnmount(() => {
  destroyMonitoredArtists();
});

const summaryCards = computed(() => ([
  {
    body: hasSeeds.value
      ? 'Followed artists shape the recommendation graph and unlock related suggestions instantly.'
      : 'Start with one artist and the recommendation graph will grow from there.',
    label: 'Following',
    value: String(seeds.value.length),
  },
  {
    body: hasSuggestions.value
      ? 'Suggestions rise when artists appear across multiple followed seeds.'
      : 'Once artists are followed, Harmoniarr ranks nearby recommendations here.',
    label: 'Suggestions',
    value: String(suggestions.value.length),
  },
  {
    body: hasSearched.value
      ? 'Search results stay separate from the graph so you can compare direct matches and recommendations.'
      : 'Search results and artwork coverage appear after your first artist lookup.',
    label: 'Search results',
    value: String(results.value.length),
  },
]));

function buildSuggestionMeta(suggestion) {
  if (!suggestion) {
    return '';
  }

  if (suggestion.seedCount > 1) {
    return `Shared by ${suggestion.seedCount} followed artists`;
  }

  return 'Suggested from your current taste graph';
}

function buildSuggestionSupport(suggestion) {
  if (!suggestion) {
    return '';
  }

  if (suggestion.score >= 1.5) {
    return 'Strong graph overlap puts this artist near the top of your current taste profile.';
  }

  return 'Worth following if you want similar release activity to enter your request flow.';
}

function isFollowedArtist(artistId) {
  return isSeed(artistId) || isMonitored(artistId);
}

function buildResultMeta(artist) {
  const parts = [];
  if (artist?.type) {
    parts.push(artist.type);
  }
  if (artist?.country) {
    parts.push(artist.country);
  }
  return parts.join(' · ');
}

function buildResultSupport(artist) {
  if (isFollowedArtist(artist?.id)) {
    return 'Already followed and contributing to your current recommendation graph.';
  }

  if (artist?.disambiguation) {
    return artist.disambiguation;
  }

  if (artist?.country && artist?.type) {
    return 'Ready to follow and route into future release discovery.';
  }

  return 'Follow this artist to seed related recommendations and future release tracking.';
}

function buildArtistLocation(artist) {
  return artist?.id ? buildArtistDetailLocation(artist.id, artist.name) : undefined;
}
</script>

<template>
  <section class="hx-page discover-view">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Discover</h1>
        <p class="hx-page-subtitle">{{ buildDiscoverPageSubtitle() }}</p>
      </div>
    </header>

    <article class="hx-card discover-stage">
      <div class="hx-card-body discover-stage__body">
        <div class="discover-stage__intro">
          <span class="discover-stage__eyebrow">Artist Discovery Workspace</span>
          <h2 class="discover-stage__title">Turn one artist into a living recommendation graph</h2>
          <p class="discover-stage__copy">
            Search for an artist you already trust, follow them, and let shared artwork plus taste-graph suggestions
            build the next layer of candidates.
          </p>
          <div class="discover-stage__signals">
            <span class="hx-pill" data-tone="success">{{ hasSeeds ? `${seeds.length} followed artist${seeds.length === 1 ? '' : 's'}` : 'No followed seeds yet' }}</span>
            <span class="hx-pill" data-tone="info">{{ hasSuggestions ? `${suggestions.length} live suggestion${suggestions.length === 1 ? '' : 's'}` : 'Suggestions appear after follow' }}</span>
            <span v-if="isAnySeedLoading || isResolvingArtistArtwork" class="hx-pill" data-tone="warning">Refreshing graph artwork</span>
          </div>
        </div>

        <form class="discover-command-form" role="search" @submit.prevent="runSearch">
          <label class="discover-command-form__label" for="discover-query">
            Start with an artist you love
          </label>
          <div class="discover-command-form__row">
            <input
              id="discover-query"
              v-model="query"
              class="hx-input discover-command-form__input"
              type="search"
              placeholder="e.g. Radiohead, Björk, Kendrick Lamar..."
              autocomplete="off"
              :disabled="isSearching"
              aria-label="Search for an artist"
            />
            <button
              type="submit"
              class="hx-btn"
              data-variant="primary"
              :disabled="isSearching || !query.trim()"
              :aria-busy="isSearching"
            >
              {{ isSearching ? 'Searching...' : 'Search' }}
            </button>
          </div>
        </form>
      </div>
    </article>

    <section class="discover-summary-grid" aria-label="Discover summary">
      <article v-for="card in summaryCards" :key="card.label" class="hx-card discover-summary-card">
        <div class="hx-card-body">
          <span class="discover-summary-card__label">{{ card.label }}</span>
          <strong class="discover-summary-card__value">{{ card.value }}</strong>
          <p class="discover-summary-card__body">{{ card.body }}</p>
        </div>
      </article>
    </section>

    <article v-if="hasSeeds" class="hx-card discover-graph-card" aria-label="Artists you might like">
      <header class="hx-card-header discover-graph-card__header">
        <div>
          <h2 class="hx-card-title">Artists you might like</h2>
          <p class="hx-card-subtitle">{{ buildDiscoverGraphSubtitle() }}</p>
        </div>
        <span v-if="isAnySeedLoading" class="hx-pill" data-tone="warning">Refreshing recommendations</span>
      </header>

      <div class="hx-card-body discover-graph-card__body">
        <section class="discover-seed-band">
          <div class="discover-seed-band__header">
            <span class="discover-summary-card__label">Followed artists</span>
            <p class="discover-seed-band__copy">
              Remove a seed to tighten the graph or add more artists to widen the recommendation field.
            </p>
          </div>

          <div class="discover-seeds" role="list" :aria-label="buildDiscoverSeedsAriaLabel()">
            <button
              v-for="seed in seeds"
              :key="seed.id"
              type="button"
              class="discover-seed-chip"
              role="listitem"
              :aria-label="buildDiscoverSeedRemoveAriaLabel(seed.name)"
              @click="removeSeed(seed.id)"
            >
              <img
                v-if="getArtistArtwork(seed.id)?.url"
                :src="getArtistArtwork(seed.id)?.url"
                :alt="seed.name"
                class="discover-seed-chip__avatar"
                loading="lazy"
              />
              <span v-else class="discover-seed-chip__initial" aria-hidden="true">{{ seed.name?.trim()?.charAt(0)?.toUpperCase() ?? '?' }}</span>
              <span class="discover-seed-chip__name">{{ seed.name }}</span>
              <span class="discover-seed-chip__remove" aria-hidden="true">Remove</span>
            </button>
          </div>
        </section>

        <p v-if="graphError" class="discover-graph-card__error" role="alert">
          {{ graphError }}
        </p>

        <section v-if="suggestions.length > 0" class="discover-suggestions">
          <div class="discover-suggestions__header">
            <span class="discover-summary-card__label">Recommendation grid</span>
            <p class="discover-suggestions__copy">
              Ranked by overlap across the artists you already follow, with shared matches pushed toward the top.
            </p>
          </div>

          <div class="hx-artwork-grid discover-grid" role="list" aria-label="Artist suggestions">
            <DiscoverArtistCard
              v-for="suggestion in suggestions"
              :key="suggestion.id"
              :artist="{ id: suggestion.id, name: suggestion.name }"
              :artwork="getArtistArtwork(suggestion.id)"
              :badge="suggestion.seedCount > 1 ? `${suggestion.seedCount} seed match` : 'Suggested'"
              :badge-tone="suggestion.seedCount > 1 ? 'success' : 'info'"
              :meta-text="buildSuggestionMeta(suggestion)"
              :supporting-text="buildSuggestionSupport(suggestion)"
              :monitored="isFollowedArtist(suggestion.id)"
              :monitoring="isMonitoring(suggestion.id)"
              :disabled="isFollowedArtist(suggestion.id)"
              :to="buildArtistLocation(suggestion)"
              @monitor="handleMonitor"
            />
          </div>
        </section>

        <p v-else-if="!isAnySeedLoading" class="discover-graph-card__empty">
          {{ buildDiscoverNoSimilarArtistsMessage() }}
        </p>
      </div>
    </article>

    <EmptyState
      v-if="searchError"
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
      v-else-if="!hasSearched && !hasSeeds"
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

    <article v-else-if="isSearching" class="hx-card discover-loading-card" aria-live="polite" aria-busy="true">
      <div class="hx-card-body">
        <p class="discover-loading-card__title">Searching artist catalog...</p>
        <p class="discover-loading-card__body">Matching artists and artwork coverage are being prepared for follow actions.</p>
      </div>
    </article>

    <EmptyState
      v-else-if="hasSearched && results.length === 0"
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

    <article v-else-if="hasSearched && results.length > 0" class="hx-card discover-results-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Search results</h2>
          <p class="hx-card-subtitle">
            Direct catalog matches stay separate from recommendations so you can follow with intent.
          </p>
        </div>
      </header>

      <div class="hx-card-body">
        <div class="hx-artwork-grid discover-grid" aria-label="Artist search results">
          <DiscoverArtistCard
            v-for="artist in results"
            :key="artist.id"
            :artist="artist"
            :artwork="getArtistArtwork(artist.id)"
            :badge="isFollowedArtist(artist.id) ? 'Already followed' : 'Search match'"
            :badge-tone="isFollowedArtist(artist.id) ? 'success' : 'info'"
            :meta-text="buildResultMeta(artist)"
            :supporting-text="buildResultSupport(artist)"
            :monitored="isFollowedArtist(artist.id)"
            :monitoring="isMonitoring(artist.id)"
            :disabled="isFollowedArtist(artist.id)"
            :to="buildArtistLocation(artist)"
            @monitor="handleMonitor"
          />
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.discover-view {
  display: grid;
  gap: var(--hx-space-5);
  align-content: start;
}

.discover-stage {
  overflow: hidden;
}

.discover-stage__body {
  display: grid;
  gap: var(--hx-space-4);
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--hx-accent-soft) 72%, transparent) 0%, transparent 54%),
    linear-gradient(180deg, color-mix(in srgb, var(--hx-bg-surface-muted) 76%, transparent) 0%, transparent 100%);
}

.discover-stage__intro {
  display: grid;
  gap: var(--hx-space-2);
}

.discover-stage__eyebrow {
  font-size: var(--hx-text-xs);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--hx-accent-strong);
}

.discover-stage__title {
  margin: 0;
  font-size: clamp(1.5rem, 2vw, 2.1rem);
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: var(--hx-text-strong);
  max-width: 18ch;
}

.discover-stage__copy {
  margin: 0;
  max-width: 64ch;
  color: var(--hx-text-muted);
}

.discover-stage__signals {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

.discover-command-form {
  display: grid;
  gap: var(--hx-space-2);
}

.discover-command-form__label {
  font-size: var(--hx-text-sm);
  font-weight: 600;
  color: var(--hx-text-strong);
}

.discover-command-form__row {
  display: flex;
  gap: var(--hx-space-2);
  align-items: center;
}

.discover-command-form__input {
  flex: 1;
  min-width: 0;
}

.discover-summary-grid {
  display: grid;
  gap: var(--hx-space-3);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.discover-summary-card__label {
  display: inline-block;
  margin-bottom: var(--hx-space-2);
  font-size: var(--hx-text-xs);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--hx-text-muted);
}

.discover-summary-card__value {
  display: block;
  font-size: clamp(1.35rem, 1.5vw, 1.7rem);
  line-height: 1.05;
  color: var(--hx-text-strong);
}

.discover-summary-card__body {
  margin: var(--hx-space-2) 0 0;
  font-size: var(--hx-text-sm);
  line-height: 1.55;
  color: var(--hx-text-muted);
}

.discover-graph-card__header {
  align-items: flex-start;
}

.discover-graph-card__body {
  display: grid;
  gap: var(--hx-space-4);
}

.discover-seed-band {
  display: grid;
  gap: var(--hx-space-3);
  padding: var(--hx-space-3);
  border-radius: var(--hx-radius-lg);
  background: color-mix(in srgb, var(--hx-bg-surface-muted) 84%, transparent);
  border: 1px solid var(--hx-border-subtle);
}

.discover-seed-band__header {
  display: grid;
  gap: var(--hx-space-1);
}

.discover-seed-band__copy,
.discover-suggestions__copy {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  line-height: 1.55;
}

.discover-seeds {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

.discover-seed-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--hx-space-2);
  min-height: 40px;
  padding: 0.4rem 0.7rem 0.4rem 0.45rem;
  border-radius: var(--hx-radius-pill);
  border: 1px solid var(--hx-border);
  background: var(--hx-bg-surface);
  color: var(--hx-text-strong);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.discover-seed-chip:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--hx-accent) 40%, var(--hx-border));
  background: color-mix(in srgb, var(--hx-accent-soft) 18%, var(--hx-bg-surface));
}

.discover-seed-chip__avatar,
.discover-seed-chip__initial {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.discover-seed-chip__avatar {
  object-fit: cover;
}

.discover-seed-chip__initial {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--hx-bg-surface-sunken);
  color: var(--hx-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
}

.discover-seed-chip__name {
  font-size: var(--hx-text-sm);
  font-weight: 600;
}

.discover-seed-chip__remove {
  font-size: var(--hx-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--hx-text-muted);
}

.discover-suggestions {
  display: grid;
  gap: var(--hx-space-3);
}

.discover-suggestions__header {
  display: grid;
  gap: var(--hx-space-1);
}

.discover-grid {
  --hx-artwork-grid-min: 180px;
}

.discover-grid .hx-media-card {
  cursor: default;
}

.discover-graph-card__error {
  margin: 0;
  color: var(--hx-danger);
  font-size: var(--hx-text-sm);
}

.discover-graph-card__empty {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
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

@media (max-width: 960px) {
  .discover-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .discover-command-form__row {
    flex-direction: column;
    align-items: stretch;
  }

  .discover-summary-grid {
    grid-template-columns: 1fr;
  }

  .discover-grid {
    --hx-artwork-grid-min: 140px;
  }

  .discover-stage__title {
    max-width: none;
  }
}
</style>
