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
import MetadataLocalSearchArtistResults from './MetadataLocalSearchArtistResults.vue';
import MetadataLocalSearchReleaseGroupResults from './MetadataLocalSearchReleaseGroupResults.vue';
import MetadataLocalSearchReleaseResults from './MetadataLocalSearchReleaseResults.vue';

const props = defineProps({
  hasSearchedLocal: {
    type: Boolean,
    default: false,
  },
  isSearchingLocal: {
    type: Boolean,
    default: false,
  },
  localArtistResults: {
    type: Array,
    required: true,
  },
  localReleaseGroupResults: {
    type: Array,
    required: true,
  },
  localReleaseResults: {
    type: Array,
    required: true,
  },
  localSearchError: {
    type: String,
    default: '',
  },
  localSearchQuery: {
    type: String,
    default: '',
  },
});

const emit = defineEmits([
  'open-artist',
  'open-release',
  'open-release-group',
  'run-search',
  'update:local-search-query',
]);

function updateSearchQuery(event) {
  emit('update:local-search-query', event.target.value);
}

function hasAnyResults() {
  return props.localArtistResults.length > 0
    || props.localReleaseGroupResults.length > 0
    || props.localReleaseResults.length > 0;
}
</script>

<template>
  <article class="panel-light">
    <div class="section-header">
      <div>
        <p class="eyebrow">Local search</p>
        <h3>Reopen imported metadata</h3>
      </div>
    </div>

    <form class="metadata-search-form" @submit.prevent="$emit('run-search')">
      <label>
        Imported metadata
        <input :value="localSearchQuery" placeholder="Search local artists, release groups, or releases" @input="updateSearchQuery" />
      </label>
      <button type="submit" :disabled="isSearchingLocal">
        {{ isSearchingLocal ? 'Searching...' : 'Search local metadata' }}
      </button>
    </form>

    <p class="error-copy" v-if="localSearchError">{{ localSearchError }}</p>

    <div class="page-stack" v-if="hasAnyResults()">
      <MetadataLocalSearchArtistResults
        :artists="localArtistResults"
        @open-artist="$emit('open-artist', $event)"
      />

      <MetadataLocalSearchReleaseGroupResults
        :release-groups="localReleaseGroupResults"
        @open-release-group="$emit('open-release-group', $event)"
      />

      <MetadataLocalSearchReleaseResults
        :releases="localReleaseResults"
        @open-release="$emit('open-release', $event)"
      />
    </div>

    <p v-else-if="hasSearchedLocal">No imported metadata matched that search.</p>
  </article>
</template>