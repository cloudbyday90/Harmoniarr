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
import { useMetadataTextFilter } from '../composables/useMetadataTextFilter.js';

const props = defineProps({
  isOpeningLocalRelease: {
    type: Boolean,
    default: false,
  },
  releases: {
    type: Array,
    required: true,
  },
});

defineEmits(['open-release']);

const { filterQuery, filteredItems: filteredReleases, hasActiveFilter } = useMetadataTextFilter({
  items: () => props.releases,
  buildSearchText: (release) => [
    release.releaseGroupTitle,
    release.title,
    release.disambiguation,
    release.status,
    release.releaseDate,
  ].filter(Boolean).join(' '),
});
</script>

<template>
  <article class="panel-light" v-if="releases.length">
    <div class="section-header">
      <div>
        <p class="eyebrow">Imported releases</p>
        <h3>Reopen local release detail</h3>
      </div>
    </div>

    <label class="metadata-filter-control">
      Filter stored releases
      <input v-model="filterQuery" placeholder="Filter by title, release group, or date" />
    </label>

    <div class="metadata-card-grid" v-if="filteredReleases.length">
      <article class="metadata-card" v-for="release in filteredReleases" :key="release.id">
        <div>
          <p class="eyebrow">{{ release.releaseGroupTitle || 'Release' }}</p>
          <h3>{{ release.title }}</h3>
          <p class="metadata-card-copy">{{ release.disambiguation || release.status || 'Stored local release' }}</p>
        </div>
        <dl>
          <div><dt>Release date</dt><dd>{{ release.releaseDate || 'Unknown' }}</dd></div>
          <div><dt>Tracks</dt><dd>{{ release.trackCount ?? 'n/a' }}</dd></div>
        </dl>
        <button type="button" @click="$emit('open-release', release)" :disabled="isOpeningLocalRelease">
          {{ isOpeningLocalRelease ? 'Opening...' : 'Open local release' }}
        </button>
      </article>
    </div>

    <p v-else-if="hasActiveFilter">No stored releases matched that filter.</p>
  </article>
</template>