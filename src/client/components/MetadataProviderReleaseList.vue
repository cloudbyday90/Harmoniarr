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
import { computed } from 'vue';
import { useMetadataTextFilter } from '../composables/useMetadataTextFilter.js';

const props = defineProps({
  errorMessage: {
    type: String,
    default: '',
  },
  isImportingRelease: {
    type: Boolean,
    default: false,
  },
  localReleases: {
    type: Array,
    required: true,
  },
  providerReleases: {
    type: Array,
    required: true,
  },
});

defineEmits(['import-release']);

const importedReleaseIds = computed(() => new Set(
  props.localReleases.map((release) => release.source.musicbrainzReleaseId),
));

const { filterQuery, filteredItems: filteredProviderReleases, hasActiveFilter } = useMetadataTextFilter({
  items: () => props.providerReleases,
  buildSearchText: (release) => [
    release.title,
    release.disambiguation,
    release.artistCredit,
    release.status,
    release.releaseDate,
  ].filter(Boolean).join(' '),
});
</script>

<template>
  <article class="panel-light" v-if="providerReleases.length">
    <div class="section-header">
      <div>
        <p class="eyebrow">Releases</p>
        <h3>Choose a release to import</h3>
      </div>
    </div>

    <p class="error-copy" v-if="errorMessage">{{ errorMessage }}</p>

    <label class="metadata-filter-control">
      Filter provider releases
      <input v-model="filterQuery" placeholder="Filter by title, status, artist credit, or date" />
    </label>

    <div class="metadata-card-grid" v-if="filteredProviderReleases.length">
      <article class="metadata-card" v-for="release in filteredProviderReleases" :key="release.id">
        <div>
          <p class="eyebrow">{{ release.status || 'Unknown status' }}</p>
          <h3>{{ release.title }}</h3>
          <p class="metadata-card-copy">{{ release.disambiguation || release.artistCredit || 'No extra release detail.' }}</p>
        </div>
        <dl>
          <div><dt>Release date</dt><dd>{{ release.releaseDate || 'Unknown' }}</dd></div>
          <div><dt>Status</dt><dd>{{ importedReleaseIds.has(release.id) ? 'Imported' : 'Provider only' }}</dd></div>
        </dl>
        <button type="button" @click="$emit('import-release', release)" :disabled="isImportingRelease">
          {{ isImportingRelease ? 'Importing...' : (importedReleaseIds.has(release.id) ? 'Re-import release' : 'Import release') }}
        </button>
      </article>
    </div>

    <p v-else-if="hasActiveFilter">No provider releases matched that filter.</p>
  </article>
</template>