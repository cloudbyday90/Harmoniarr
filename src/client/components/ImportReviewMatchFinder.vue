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
import { computed, ref } from 'vue';
import ImportCandidateFilters from './ImportCandidateFilters.vue';
import ImportCandidateQueueList from './ImportCandidateQueueList.vue';

const props = defineProps({
  activeFilterCount: {
    type: Number,
    default: 0,
  },
  candidates: {
    type: Array,
    required: true,
  },
  folderPath: {
    type: String,
    default: '',
  },
  isLoadingQueue: {
    type: Boolean,
    default: false,
  },
  lastLoadedAt: {
    type: String,
    default: null,
  },
  listError: {
    type: String,
    default: '',
  },
  selectedCandidateId: {
    type: String,
    default: null,
  },
  sourceSearchId: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    default: 'pending',
  },
  totalCandidates: {
    type: Number,
    default: 0,
  },
  username: {
    type: String,
    default: '',
  },
});

const emit = defineEmits([
  'apply-filters',
  'refresh',
  'reset-filters',
  'select-match',
  'update:folder-path',
  'update:source-search-id',
  'update:status',
  'update:username',
]);

const isOpen = ref(false);
const filterSummary = computed(() => {
  if (!props.activeFilterCount) {
    return 'No filters active';
  }

  return `${props.activeFilterCount} active ${props.activeFilterCount === 1 ? 'filter' : 'filters'}`;
});

function selectMatch(matchId) {
  isOpen.value = false;
  emit('select-match', matchId);
}
</script>

<template>
  <details
    class="import-review-match-finder"
    :open="isOpen"
    @toggle="isOpen = $event.currentTarget.open"
  >
    <summary class="import-review-match-finder__summary">
      <hgroup class="import-review-match-finder__heading">
        <p class="import-review-match-finder__eyebrow">Advanced diagnostics</p>
        <h2 class="import-review-match-finder__title">Search saved matches</h2>
        <p class="import-review-match-finder__copy">
          Use this only when the current recovery needs a different saved match or a closer look at its source details.
        </p>
      </hgroup>
      <div class="import-review-match-finder__state">
        <span>{{ filterSummary }}</span>
        <strong>{{ isOpen ? 'Hide' : 'Show' }}</strong>
      </div>
    </summary>

    <div class="import-review-match-finder__content">
      <p class="import-review-match-finder__notice">
        The selected match above remains the recovery focus. Choosing a result here switches that focus without changing any download or library state.
      </p>

      <div class="import-review-match-finder__filters">
        <ImportCandidateFilters
          :folder-path="folderPath"
          :is-loading-queue="isLoadingQueue"
          :source-search-id="sourceSearchId"
          :status="status"
          :username="username"
          @apply-filters="$emit('apply-filters')"
          @reset-filters="$emit('reset-filters')"
          @update:folder-path="$emit('update:folder-path', $event)"
          @update:source-search-id="$emit('update:source-search-id', $event)"
          @update:status="$emit('update:status', $event)"
          @update:username="$emit('update:username', $event)"
        />
      </div>

      <ImportCandidateQueueList
        :candidates="candidates"
        :is-loading-queue="isLoadingQueue"
        :last-loaded-at="lastLoadedAt"
        :list-error="listError"
        :selected-candidate-id="selectedCandidateId"
        :total-candidates="totalCandidates"
        @refresh="$emit('refresh')"
        @select-candidate="selectMatch"
      />
    </div>
  </details>
</template>

<style scoped>
.import-review-match-finder {
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface);
  box-shadow: var(--hx-shadow-sm);
}

.import-review-match-finder__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-4);
  padding: var(--hx-space-4);
  cursor: pointer;
  list-style: none;
}

.import-review-match-finder__summary::-webkit-details-marker {
  display: none;
}

.import-review-match-finder__summary:focus-visible {
  border-radius: var(--hx-radius-sm);
  outline: 2px solid var(--hx-accent);
  outline-offset: -3px;
}

.import-review-match-finder__eyebrow {
  margin: 0 0 var(--hx-space-2);
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.import-review-match-finder__heading {
  margin: 0;
}

.import-review-match-finder__title {
  margin: 0;
  color: var(--hx-text-strong);
  font-size: var(--hx-text-lg);
}

.import-review-match-finder__copy,
.import-review-match-finder__notice {
  max-width: 74ch;
  margin: var(--hx-space-2) 0 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.5;
}

.import-review-match-finder__state {
  display: grid;
  flex: 0 0 auto;
  gap: var(--hx-space-1);
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
  text-align: right;
}

.import-review-match-finder__state strong {
  color: var(--hx-accent);
  font-size: var(--hx-text-sm);
}

.import-review-match-finder__content {
  display: grid;
  gap: var(--hx-space-4);
  padding: 0 var(--hx-space-4) var(--hx-space-4);
}

.import-review-match-finder__notice {
  margin: 0;
}

.import-review-match-finder__filters {
  padding-bottom: var(--hx-space-4);
  border-bottom: 1px solid var(--hx-border-subtle);
}

@media (max-width: 640px) {
  .import-review-match-finder__summary {
    align-items: flex-start;
  }

  .import-review-match-finder__state {
    text-align: left;
  }
}
</style>
