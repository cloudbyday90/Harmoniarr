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
  isOpeningLocalReleaseGroup: {
    type: Boolean,
    default: false,
  },
  releaseGroups: {
    type: Array,
    required: true,
  },
});

defineEmits(['open-release-group']);

const { filterQuery, filteredItems: filteredReleaseGroups, hasActiveFilter } = useMetadataTextFilter({
  items: () => props.releaseGroups,
  buildSearchText: (releaseGroup) => [
    releaseGroup.title,
    releaseGroup.primaryType,
    Array.isArray(releaseGroup.secondaryTypes) ? releaseGroup.secondaryTypes.join(' ') : '',
    releaseGroup.disambiguation,
    releaseGroup.firstReleaseDate,
  ].filter(Boolean).join(' '),
});
</script>

<template>
  <article class="panel-light" v-if="releaseGroups.length">
    <div class="section-header">
      <div>
        <p class="eyebrow">Imported release groups</p>
        <h3>Reopen local release-group detail</h3>
      </div>
    </div>

    <label class="metadata-filter-control">
      Filter stored release groups
      <input v-model="filterQuery" placeholder="Filter by title, type, or date" />
    </label>

    <div class="metadata-card-grid" v-if="filteredReleaseGroups.length">
      <article class="metadata-card" v-for="releaseGroup in filteredReleaseGroups" :key="releaseGroup.id">
        <div>
          <p class="eyebrow">{{ releaseGroup.primaryType || 'Release group' }}</p>
          <h3>{{ releaseGroup.title }}</h3>
          <p class="metadata-card-copy">{{ releaseGroup.disambiguation || 'Stored local release group' }}</p>
        </div>
        <dl>
          <div><dt>First release</dt><dd>{{ releaseGroup.firstReleaseDate || 'Unknown' }}</dd></div>
          <div><dt>Stored releases</dt><dd>{{ releaseGroup.releaseCount ?? 0 }}</dd></div>
        </dl>
        <button type="button" @click="$emit('open-release-group', releaseGroup)" :disabled="isOpeningLocalReleaseGroup">
          {{ isOpeningLocalReleaseGroup ? 'Opening...' : 'Open local release group' }}
        </button>
      </article>
    </div>

    <p v-else-if="hasActiveFilter">No stored release groups matched that filter.</p>
  </article>
</template>