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
import ArtworkImage from '../components/ArtworkImage.vue';
import EmptyState from '../components/EmptyState.vue';
import { useDiscoverSearch } from '../composables/useDiscoverSearch.js';

const {
  artistStates,
  hasMonitored,
  hasSearched,
  isSearching,
  monitorArtist,
  query,
  results,
  runSearch,
  searchError,
} = useDiscoverSearch();

/** Build a readable metadata line from artist fields. */
function artistMeta(artist) {
  const parts = [];
  if (artist.type) parts.push(artist.type);
  if (artist.country) parts.push(artist.country);
  if (artist.disambiguation) parts.push(artist.disambiguation);
  return parts.join(' · ');
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

    <!-- Error state -->
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
      v-else-if="!hasSearched"
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

    <!-- Artist card grid -->
    <section
      v-else
      class="hx-artwork-grid discover-grid"
      aria-label="Artist search results"
    >
      <article
        v-for="artist in results"
        :key="artist.id"
        class="hx-media-card"
      >
        <div class="hx-media-card__artwork">
          <ArtworkImage :alt="artist.name" />
        </div>
        <div class="hx-media-card__body">
          <p class="hx-media-card__title">{{ artist.name }}</p>
          <p v-if="artistMeta(artist)" class="hx-media-card__meta">{{ artistMeta(artist) }}</p>
        </div>
        <div class="hx-media-card__actions">
          <button
            type="button"
            class="hx-btn"
            :data-variant="artistStates[artist.id] === 'monitored' ? 'ghost' : 'primary'"
            :disabled="artistStates[artist.id] === 'monitoring' || artistStates[artist.id] === 'monitored'"
            :aria-label="artistStates[artist.id] === 'monitored' ? `${artist.name} — already monitored` : `Monitor ${artist.name}`"
            @click="monitorArtist(artist)"
          >
            <template v-if="artistStates[artist.id] === 'monitoring'">Monitoring…</template>
            <template v-else-if="artistStates[artist.id] === 'monitored'">Monitored</template>
            <template v-else>Monitor</template>
          </button>
        </div>
      </article>
    </section>
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
</style>
