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
defineProps({
  isImportingArtist: {
    type: Boolean,
    default: false,
  },
  isLoadingArtist: {
    type: Boolean,
    default: false,
  },
  isSearching: {
    type: Boolean,
    default: false,
  },
  searchError: {
    type: String,
    default: '',
  },
  searchQuery: {
    type: String,
    default: '',
  },
  searchResults: {
    type: Array,
    required: true,
  },
  selectedArtistId: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['import-artist', 'run-search', 'update:search-query']);

function updateSearchQuery(event) {
  emit('update:search-query', event.target.value);
}
</script>

<template>
  <article class="hx-card">
    <header class="hx-card-header">
      <div>
        <h3 class="hx-card-title">Find an artist</h3>
        <p class="hx-card-subtitle">Search MusicBrainz to find an artist you want to import for the first time.</p>
      </div>
    </header>

    <div class="hx-card-body">
      <form class="metadata-search-form" @submit.prevent="$emit('run-search')">
        <label>
          Artist name
          <input :value="searchQuery" placeholder="Type an artist name" @input="updateSearchQuery" />
        </label>
        <button type="submit" :disabled="isSearching">
          {{ isSearching ? 'Searching...' : 'Search MusicBrainz' }}
        </button>
      </form>

      <p class="error-copy" v-if="searchError">{{ searchError }}</p>

      <div class="metadata-card-grid" v-if="searchResults.length">
        <article class="metadata-card" v-for="artist in searchResults" :key="artist.id">
          <div>
            <p class="hx-text-muted">{{ artist.type ?? 'Artist' }}</p>
            <h3>{{ artist.name }}</h3>
            <p class="hx-text-muted">{{ artist.disambiguation || 'No disambiguation provided.' }}</p>
          </div>
          <dl>
            <div><dt>Country</dt><dd>{{ artist.country || 'Unknown' }}</dd></div>
            <div><dt>Score</dt><dd>{{ artist.score ?? 'n/a' }}</dd></div>
          </dl>
          <button
            type="button"
            @click="$emit('import-artist', artist)"
            :disabled="isImportingArtist || isLoadingArtist"
          >
            {{ isImportingArtist && selectedArtistId === artist.id ? 'Importing...' : 'Import artist' }}
          </button>
        </article>
      </div>
    </div>
  </article>
</template>
