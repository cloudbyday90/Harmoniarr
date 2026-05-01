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
  isLoadingReleaseGroup: {
    type: Boolean,
    default: false,
  },
  isMutatingReleaseGroup: {
    type: Boolean,
    default: false,
  },
  localReleaseGroups: {
    type: Array,
    required: true,
  },
  providerReleaseGroups: {
    type: Array,
    required: true,
  },
});

defineEmits(['import-release-group', 'open-release-group']);

const importedReleaseGroupIds = computed(() => new Set(
  props.localReleaseGroups.map((releaseGroup) => releaseGroup.source.musicbrainzReleaseGroupId),
));

const { filterQuery, filteredItems: filteredReleaseGroups, hasActiveFilter } = useMetadataTextFilter({
  items: () => props.providerReleaseGroups,
  buildSearchText: (releaseGroup) => [
    releaseGroup.title,
    releaseGroup.primaryType,
    Array.isArray(releaseGroup.secondaryTypes) ? releaseGroup.secondaryTypes.join(' ') : '',
    releaseGroup.disambiguation,
    releaseGroup.firstReleaseDate,
  ].filter(Boolean).join(' '),
});

function formatSecondaryTypes(secondaryTypes) {
  return Array.isArray(secondaryTypes) && secondaryTypes.length
    ? secondaryTypes.join(', ')
    : 'No secondary types';
}
</script>

<template>
  <article class="panel-light">
    <div class="section-header">
      <div>
        <p class="eyebrow">Release groups</p>
        <h3>Provider browse with local reconciliation</h3>
      </div>
    </div>

    <p class="error-copy" v-if="errorMessage">{{ errorMessage }}</p>

    <label class="metadata-filter-control" v-if="providerReleaseGroups.length">
      Filter provider release groups
      <input v-model="filterQuery" placeholder="Filter by title, type, or date" />
    </label>

    <div class="metadata-card-grid" v-if="filteredReleaseGroups.length">
      <article class="metadata-card" v-for="releaseGroup in filteredReleaseGroups" :key="releaseGroup.id">
        <div>
          <p class="eyebrow">{{ releaseGroup.primaryType || 'Unknown type' }}</p>
          <h3>{{ releaseGroup.title }}</h3>
          <p class="metadata-card-copy">{{ releaseGroup.disambiguation || formatSecondaryTypes(releaseGroup.secondaryTypes) }}</p>
        </div>
        <dl>
          <div><dt>First release</dt><dd>{{ releaseGroup.firstReleaseDate || 'Unknown' }}</dd></div>
          <div><dt>Status</dt><dd>{{ importedReleaseGroupIds.has(releaseGroup.id) ? 'Imported' : 'Provider only' }}</dd></div>
        </dl>
        <button
          type="button"
          @click="importedReleaseGroupIds.has(releaseGroup.id) ? $emit('open-release-group', releaseGroup) : $emit('import-release-group', releaseGroup)"
          :disabled="isMutatingReleaseGroup || isLoadingReleaseGroup"
        >
          {{ isMutatingReleaseGroup ? 'Importing...' : (importedReleaseGroupIds.has(releaseGroup.id) ? 'Open release group' : 'Import release group') }}
        </button>
      </article>
    </div>

    <p v-else-if="hasActiveFilter">No provider release groups matched that filter.</p>
    <p v-else>No release groups were returned for this artist yet.</p>
  </article>
</template>