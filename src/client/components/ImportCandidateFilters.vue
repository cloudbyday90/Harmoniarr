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
import { computed, ref, watch } from 'vue';

const props = defineProps({
  folderPath: {
    type: String,
    default: '',
  },
  isLoadingQueue: {
    type: Boolean,
    default: false,
  },
  sourceSearchId: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    default: 'pending',
  },
  username: {
    type: String,
    default: '',
  },
});

const emit = defineEmits([
  'apply-filters',
  'reset-filters',
  'update:folder-path',
  'update:source-search-id',
  'update:status',
  'update:username',
]);

const hasAdvancedFilters = computed(() => (
  [props.sourceSearchId, props.username].some((value) => typeof value === 'string' && value.trim())
));
const advancedFilterSummary = computed(() => {
  const activeCount = [props.sourceSearchId, props.username]
    .filter((value) => typeof value === 'string' && value.trim())
    .length;

  if (activeCount === 0) {
    return 'Optional source details';
  }

  return `${activeCount} active ${activeCount === 1 ? 'filter' : 'filters'}`;
});
const isAdvancedFiltersOpen = ref(false);

watch(hasAdvancedFilters, (hasActiveFilters, hadActiveFilters) => {
  if (hasActiveFilters && !hadActiveFilters) {
    isAdvancedFiltersOpen.value = true;
  }
}, { immediate: true });

function updateField(event, eventName) {
  emit(eventName, event.target.value);
}

function resetFilters() {
  isAdvancedFiltersOpen.value = false;
  emit('reset-filters');
}
</script>

<template>
  <form
    class="import-candidate-filters"
    aria-describedby="saved-match-search-instructions"
    aria-label="Search saved matches"
    role="search"
    @submit.prevent="$emit('apply-filters')"
  >
    <fieldset class="import-candidate-filters__primary">
      <legend>Filter saved matches</legend>
      <p id="saved-match-search-instructions" class="import-candidate-filters__instructions">
        Start with a saved-match status or text from the saved folder name.
      </p>

      <div class="import-candidate-filters__field-grid">
        <div class="hx-field">
          <label class="hx-field-label" for="import-candidate-status-filter">Show</label>
          <select
            id="import-candidate-status-filter"
            class="hx-select"
            :value="status"
            @change="updateField($event, 'update:status')"
          >
            <option value="">All saved matches</option>
            <option value="pending">Pending</option>
            <option value="held">Paused</option>
            <option value="rejected">Not using</option>
            <option value="selected">Selected</option>
            <option value="downloading">Downloading</option>
            <option value="import_pending">Ready to add</option>
            <option value="applied">In library</option>
            <option value="failed">Needs attention</option>
          </select>
        </div>

        <div class="hx-field">
          <label class="hx-field-label" for="import-candidate-folder-filter">Folder contains</label>
          <input
            id="import-candidate-folder-filter"
            class="hx-input"
            :value="folderPath"
            type="search"
            autocomplete="off"
            placeholder="Artist or album folder"
            spellcheck="false"
            @input="updateField($event, 'update:folder-path')"
          />
        </div>
      </div>
    </fieldset>

    <details
      class="import-candidate-filters__advanced"
      :open="isAdvancedFiltersOpen"
      @toggle="isAdvancedFiltersOpen = $event.currentTarget.open"
    >
      <summary>
        <span>More filters</span>
        <small>{{ advancedFilterSummary }}</small>
      </summary>

      <div class="import-candidate-filters__advanced-content">
        <p>
          Use these recorded provider details only when troubleshooting a specific saved result.
        </p>

        <div class="import-candidate-filters__field-grid">
          <div class="hx-field">
            <label class="hx-field-label" for="import-candidate-search-reference-filter">Saved search reference</label>
            <input
              id="import-candidate-search-reference-filter"
              class="hx-input"
              :value="sourceSearchId"
              type="search"
              autocomplete="off"
              placeholder="search-123"
              spellcheck="false"
              @input="updateField($event, 'update:source-search-id')"
            />
          </div>

          <div class="hx-field">
            <label class="hx-field-label" for="import-candidate-source-user-filter">Source user</label>
            <input
              id="import-candidate-source-user-filter"
              class="hx-input"
              :value="username"
              type="search"
              autocomplete="off"
              placeholder="source-user"
              spellcheck="false"
              @input="updateField($event, 'update:username')"
            />
          </div>
        </div>
      </div>
    </details>

    <div class="import-candidate-filters__actions">
      <button type="submit" class="hx-btn" data-variant="primary" :disabled="isLoadingQueue">
        {{ isLoadingQueue ? 'Searching...' : 'Search saved matches' }}
      </button>
      <button type="button" class="hx-btn" data-variant="ghost" @click="resetFilters">
        Clear search
      </button>
    </div>
  </form>
</template>

<style scoped>
.import-candidate-filters {
  display: grid;
  gap: var(--hx-space-3);
}

.import-candidate-filters__primary {
  display: grid;
  gap: var(--hx-space-3);
  min-inline-size: 0;
  margin: 0;
  padding: var(--hx-space-3);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-sm);
}

.import-candidate-filters__primary legend {
  padding: 0 var(--hx-space-1);
  color: var(--hx-text-strong);
  font-size: var(--hx-text-sm);
  font-weight: 700;
}

.import-candidate-filters__instructions,
.import-candidate-filters__advanced-content > p {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.5;
}

.import-candidate-filters__field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--hx-space-3);
}

.import-candidate-filters__advanced {
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-sm);
}

.import-candidate-filters__advanced summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-3);
  min-height: 44px;
  padding: 0 var(--hx-space-3);
  color: var(--hx-text);
  cursor: pointer;
  font-size: var(--hx-text-sm);
  font-weight: 650;
  list-style: none;
}

.import-candidate-filters__advanced summary::-webkit-details-marker {
  display: none;
}

.import-candidate-filters__advanced summary:focus-visible {
  border-radius: var(--hx-radius-xs);
  outline: 2px solid var(--hx-accent);
  outline-offset: -3px;
}

.import-candidate-filters__advanced summary small {
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
  font-weight: 500;
  text-align: right;
}

.import-candidate-filters__advanced-content {
  display: grid;
  gap: var(--hx-space-3);
  padding: 0 var(--hx-space-3) var(--hx-space-3);
}

.import-candidate-filters__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

@media (max-width: 640px) {
  .import-candidate-filters__field-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .import-candidate-filters__actions > .hx-btn {
    flex: 1 1 auto;
  }
}
</style>
