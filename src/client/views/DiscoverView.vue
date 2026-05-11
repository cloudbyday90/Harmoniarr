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
import ArtistCard from '../components/media/ArtistCard.vue';
import EmptyState from '../components/EmptyState.vue';
import { useArtistMonitoring } from '../composables/useArtistMonitoring.js';
import { useDiscoverSearch } from '../composables/useDiscoverSearch.js';
import { useDiscoverGraph } from '../composables/useDiscoverGraph.js';
import { buildArtistDetailLocation } from '../lib/artist-detail-route.js';
import { getArtistAvatar } from '../lib/artist-avatar.js';

const {
  hasSearched,
  isSearching,
  query,
  results,
  runSearch,
  searchError,
} = useDiscoverSearch();

const {
  hasMonitored,
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
  isSeedLoading,
  addSeed,
  removeSeed,
} = useDiscoverGraph();

/**
 * Monitor an artist and, on success, add them as a taste-graph seed so that
 * similar artists are automatically surfaced as suggestions.
 */
async function handleMonitor(artist) {
  const result = await monitorArtist(artist);
  if (result?.success) {
    await addSeed(artist);
  }
}

function avatarStyle(artist) {
  const avatar = getArtistAvatar(artist.id, artist.name);
  return { background: avatar.bg, color: avatar.fg };
}

function artistInitial(artist) {
  return getArtistAvatar(artist.id, artist.name).initial;
}
</script>

<template>
  <div class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Discover</h1>
        <p class="hx-page-subtitle">Find artists you love and monitor them for new releases.</p>
      </div>

      <div v-if="hasMonitored" class="hx-page-actions">
        <RouterLink :to="{ name: 'dashboard' }" class="hx-btn" data-variant="primary">
          Done — go to Home
        </RouterLink>
      </div>
    </header>

    <!-- Search form -->
    <form class="discover-search-form" role="search" @submit.prevent="runSearch">
      <label class="discover-search-label" for="discover-query">
        Start with an artist you love
      </label>
      <div class="discover-search-row">
        <input
          id="discover-query"
          v-model="query"
          class="hx-input discover-search-input"
          type="search"
          placeholder="e.g. Radiohead, Björk, Kendrick Lamar…"
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
          {{ isSearching ? 'Searching…' : 'Search' }}
        </button>
      </div>
    </form>

    <!-- ── Taste graph: seeds + suggestions ──────────────────────────────── -->
    <section v-if="hasSeeds" class="discover-graph" aria-label="Artists you might like">
      <div class="discover-graph-header">
        <div>
          <h2 class="discover-graph-title">Artists you might like</h2>
          <p class="discover-graph-subtitle">
            Based on artists you've monitored
          </p>
        </div>
        <p
          v-if="isAnySeedLoading"
          class="discover-graph-loading"
          aria-live="polite"
          aria-busy="true"
        >
          Finding similar artists…
        </p>
      </div>

      <!-- Seed chips -->
      <div class="discover-seeds" role="list" aria-label="Your taste seeds">
        <span
          v-for="seed in seeds"
          :key="seed.id"
          class="discover-seed-chip"
          role="listitem"
        >
          <span class="discover-seed-chip-name">{{ seed.name }}</span>
          <span
            v-if="isSeedLoading(seed.id)"
            class="discover-seed-chip-loading"
            aria-label="Loading similar artists"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" class="discover-seed-spinner">
              <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="28" stroke-dashoffset="10"/>
            </svg>
          </span>
          <button
            v-else
            type="button"
            class="discover-seed-chip-remove"
            :aria-label="`Remove ${seed.name} from taste seeds`"
            @click="removeSeed(seed.id)"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8"/>
            </svg>
          </button>
        </span>
      </div>

      <!-- Graph error -->
      <p v-if="graphError" class="discover-graph-error" role="alert">
        {{ graphError }}
      </p>

      <!-- Suggestions grid -->
      <div
        v-if="hasSuggestions"
        class="hx-artwork-grid discover-grid"
        role="list"
        aria-label="Artist suggestions"
      >
        <ArtistCard
          v-for="suggestion in suggestions"
          :key="suggestion.id"
          :artist="{ id: suggestion.id, name: suggestion.name }"
          :monitored="isMonitored(suggestion.id)"
          :monitoring="isMonitoring(suggestion.id)"
          :disabled="isSeed(suggestion.id)"
          :to="suggestion.id ? buildArtistDetailLocation(suggestion.id, suggestion.name) : undefined"
          @monitor="handleMonitor"
        >
          <template #artwork>
            <div
              class="hx-artwork discover-suggestion-avatar"
              :style="avatarStyle(suggestion)"
              aria-hidden="true"
            >
              <span class="discover-suggestion-initial">{{ artistInitial(suggestion) }}</span>
            </div>
          </template>
        </ArtistCard>
      </div>

      <!-- No suggestions yet (all seeds loaded, nothing to show) -->
      <p
        v-else-if="!isAnySeedLoading"
        class="discover-graph-empty"
      >
        No similar artists found for your current picks.
      </p>
    </section>

    <!-- ── Search error ───────────────────────────────────────────────────── -->
    <EmptyState
      v-if="searchError"
      :title="searchError"
      body="Check your connection or try a different artist name."
      variant="discover"
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
      v-else-if="!hasSearched && !hasSeeds"
      title="Search for an artist to get started"
      body="Type an artist name above and press Search. Once you monitor artists, Harmoniarr will surface new releases for you to request."
      variant="discover"
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
    <p v-else-if="isSearching" class="discover-loading" aria-live="polite" aria-busy="true">
      Searching…
    </p>

    <!-- No results -->
    <EmptyState
      v-else-if="hasSearched && !isSearching && results.length === 0"
      title="No artists found"
      body="Try a different spelling or a broader search term."
      variant="discover"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/>
          <path d="m20 20-3.5-3.5"/>
          <path d="M8 11h6"/>
        </svg>
      </template>
    </EmptyState>

    <!-- Search results -->
    <template v-else-if="hasSearched && !isSearching && results.length > 0">
      <h2 v-if="hasSeeds" class="discover-results-heading">Search results</h2>
      <section
        class="hx-artwork-grid discover-grid"
        aria-label="Artist search results"
      >
        <ArtistCard
          v-for="artist in results"
          :key="artist.id"
          :artist="artist"
          :monitored="isMonitored(artist.id)"
          :monitoring="isMonitoring(artist.id)"
          :to="artist.id ? buildArtistDetailLocation(artist.id, artist.name) : undefined"
          @monitor="handleMonitor"
        >
          <template #artwork>
            <div
              class="hx-artwork discover-suggestion-avatar"
              :style="avatarStyle(artist)"
              aria-hidden="true"
            >
              <span class="discover-suggestion-initial">{{ artistInitial(artist) }}</span>
            </div>
          </template>
        </ArtistCard>
      </section>
    </template>
  </div>
</template>

<style scoped>
.discover-search-form {
  display: grid;
  gap: var(--hx-space-2);
}

.discover-search-label {
  font-size: var(--hx-text-sm);
  font-weight: 600;
  color: var(--hx-text-strong);
}

.discover-search-row {
  display: flex;
  gap: var(--hx-space-2);
  align-items: center;
}

.discover-search-input {
  flex: 1;
  min-width: 0;
}

.discover-loading {
  text-align: center;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  padding: var(--hx-space-6) 0;
}

.discover-grid {
  --hx-artwork-grid-min: 160px;
}

/* Cards inside Discover should not use cursor:pointer for the whole card
   since the clickable element is the Monitor button only. */
.discover-grid .hx-media-card {
  cursor: default;
}

/* ── Taste graph section ─────────────────────────────────────────────────── */

.discover-graph {
  display: grid;
  gap: var(--hx-space-4);
  padding-top: var(--hx-space-2);
  border-top: 1px solid var(--hx-border);
}

.discover-graph-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--hx-space-4);
  flex-wrap: wrap;
}

.discover-graph-title {
  font-size: var(--hx-text-base);
  font-weight: 600;
  color: var(--hx-text-strong);
  margin: 0;
}

.discover-graph-subtitle {
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  margin: 0;
}

.discover-graph-loading {
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  margin: 0;
  align-self: center;
}

.discover-graph-error {
  font-size: var(--hx-text-sm);
  color: var(--hx-text-danger, #e53e3e);
  margin: 0;
}

.discover-graph-empty {
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  margin: 0;
}

/* Seed chips */

.discover-seeds {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
  align-items: center;
}

.discover-seed-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem 0.25rem 0.75rem;
  border-radius: 9999px;
  background: var(--hx-bg-surface-raised);
  border: 1px solid var(--hx-border);
  font-size: var(--hx-text-sm);
  color: var(--hx-text-strong);
  line-height: 1.25;
}

.discover-seed-chip-name {
  max-width: 16ch;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.discover-seed-chip-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--hx-text-muted);
  border-radius: 9999px;
  transition: color 0.1s, background 0.1s;
}

.discover-seed-chip-remove:hover {
  color: var(--hx-text-strong);
  background: var(--hx-bg-surface-hover, rgba(0,0,0,0.08));
}

.discover-seed-chip-remove svg {
  width: 0.75rem;
  height: 0.75rem;
}

.discover-seed-chip-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  color: var(--hx-text-muted);
}

.discover-seed-spinner {
  width: 0.875rem;
  height: 0.875rem;
  animation: discover-spin 1s linear infinite;
}

@keyframes discover-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Suggestion avatar — replaces the ArtworkImage placeholder for graph cards */

.discover-suggestion-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--hx-radius, 4px);
}

.discover-suggestion-initial {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  user-select: none;
}

/* Search results heading — only visible when seeds section is also present */

.discover-results-heading {
  font-size: var(--hx-text-base);
  font-weight: 600;
  color: var(--hx-text-strong);
  margin: 0;
  padding-top: var(--hx-space-2);
  border-top: 1px solid var(--hx-border);
}

/* ── Mobile ─────────────────────────────────────────────────────────────── */

@media (max-width: 640px) {
  /*
   * Stack the search input + button vertically on narrow screens.
   * Mirrors the same fix applied to SearchView in chunk 4.
   */
  .discover-search-row {
    flex-direction: column;
    align-items: stretch;
  }

  /*
   * .discover-grid overrides --hx-artwork-grid-min: 160px via scoped styles,
   * which wins over the global 640px rule due to scoped-attribute specificity.
   * Re-override here so two columns still render on narrow phones.
   */
  .discover-grid {
    --hx-artwork-grid-min: 140px;
  }
}
</style>
