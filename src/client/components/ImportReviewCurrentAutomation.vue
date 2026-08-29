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
import ImportPendingCandidateStatusPanel from './ImportPendingCandidateStatusPanel.vue';
import SelectedImportCandidateStatusPanel from './SelectedImportCandidateStatusPanel.vue';
import { buildCurrentAutomationPresentation } from '../lib/import-review-current-automation-presentation.js';

const props = defineProps({
  importPendingCandidates: {
    type: Array,
    default: () => [],
  },
  importPendingCounts: {
    type: Object,
    default: () => ({}),
  },
  importPendingError: {
    type: String,
    default: '',
  },
  importPendingSummary: {
    type: Object,
    default: null,
  },
  isLoadingImportPending: {
    type: Boolean,
    default: false,
  },
  isLoadingSelected: {
    type: Boolean,
    default: false,
  },
  isOpen: {
    type: Boolean,
    default: false,
  },
  selectedCandidates: {
    type: Array,
    default: () => [],
  },
  selectedCounts: {
    type: Object,
    default: () => ({}),
  },
  selectedError: {
    type: String,
    default: '',
  },
  selectedSummary: {
    type: Object,
    default: null,
  },
});

defineEmits(['update:isOpen']);

const presentation = computed(() => buildCurrentAutomationPresentation({
  importPendingCounts: props.importPendingCounts,
  isLoadingImportPending: props.isLoadingImportPending,
  isLoadingSelected: props.isLoadingSelected,
  selectedCounts: props.selectedCounts,
}));

const shouldShowSelectedDetails = computed(() =>
  props.isLoadingSelected || Boolean(props.selectedError) || props.selectedCandidates.length > 0,
);

const shouldShowImportPendingDetails = computed(() =>
  props.isLoadingImportPending || Boolean(props.importPendingError) || props.importPendingCandidates.length > 0,
);
</script>

<template>
  <details
    class="import-review-current-automation"
    :open="isOpen"
    @toggle="$emit('update:isOpen', $event.currentTarget.open)"
  >
    <summary class="import-review-current-automation__summary">
      <hgroup class="import-review-current-automation__heading">
        <p class="import-review-current-automation__eyebrow">Current automation</p>
        <h2 class="import-review-current-automation__title">Download and library progress</h2>
        <p class="import-review-current-automation__copy">
          Missing Music follows normal release progress. Open this only to inspect selected matches or completed downloads that need a library step.
        </p>
      </hgroup>
      <div class="import-review-current-automation__state">
        <span>{{ presentation.summary }}</span>
        <strong>{{ isOpen ? 'Hide' : 'Show' }}</strong>
      </div>
    </summary>

    <div class="import-review-current-automation__content">
      <div class="import-review-current-automation__handoff">
        <p>
          Follow automatic searches, downloads, and quality recovery in Missing Music. These details are available for exceptional diagnosis.
        </p>
        <RouterLink class="hx-btn" data-variant="ghost" :to="{ name: 'missing' }">
          Open Missing Music
        </RouterLink>
      </div>

      <p v-if="!presentation.hasWork && !shouldShowSelectedDetails && !shouldShowImportPendingDetails" class="import-review-current-automation__empty">
        Harmoniarr has no selected matches or completed downloads that need a library step right now.
      </p>

      <div
        v-else
        class="import-review-current-automation__details"
        :class="{
          'import-review-current-automation__details--single': shouldShowSelectedDetails !== shouldShowImportPendingDetails,
        }"
      >
        <SelectedImportCandidateStatusPanel
          v-if="shouldShowSelectedDetails"
          :counts="selectedCounts"
          :error-message="selectedError"
          :is-loading="isLoadingSelected"
          :selected-candidates="selectedCandidates"
          :summary="selectedSummary"
        />

        <ImportPendingCandidateStatusPanel
          v-if="shouldShowImportPendingDetails"
          :counts="importPendingCounts"
          :error-message="importPendingError"
          :import-pending-candidates="importPendingCandidates"
          :is-loading="isLoadingImportPending"
          :summary="importPendingSummary"
        />
      </div>
    </div>
  </details>
</template>

<style scoped>
.import-review-current-automation {
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface);
  box-shadow: var(--hx-shadow-sm);
}

.import-review-current-automation__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-4);
  padding: var(--hx-space-4);
  cursor: pointer;
  list-style: none;
}

.import-review-current-automation__summary::-webkit-details-marker {
  display: none;
}

.import-review-current-automation__summary:focus-visible {
  border-radius: var(--hx-radius-sm);
  outline: 2px solid var(--hx-accent);
  outline-offset: -3px;
}

.import-review-current-automation__heading {
  margin: 0;
  min-width: 0;
}

.import-review-current-automation__eyebrow {
  margin: 0 0 var(--hx-space-2);
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.import-review-current-automation__title {
  margin: 0;
  color: var(--hx-text-strong);
  font-size: var(--hx-text-lg);
}

.import-review-current-automation__copy,
.import-review-current-automation__handoff p,
.import-review-current-automation__empty {
  max-width: 74ch;
  margin: var(--hx-space-2) 0 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.5;
}

.import-review-current-automation__state {
  display: grid;
  flex: 0 0 auto;
  gap: var(--hx-space-1);
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
  text-align: right;
}

.import-review-current-automation__state strong {
  color: var(--hx-accent);
  font-size: var(--hx-text-sm);
}

.import-review-current-automation__content {
  display: grid;
  gap: var(--hx-space-4);
  padding: 0 var(--hx-space-4) var(--hx-space-4);
}

.import-review-current-automation__handoff {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-4);
  padding-bottom: var(--hx-space-4);
  border-bottom: 1px solid var(--hx-border-subtle);
}

.import-review-current-automation__handoff p,
.import-review-current-automation__empty {
  margin: 0;
}

.import-review-current-automation__details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--hx-space-4);
}

.import-review-current-automation__details--single {
  grid-template-columns: minmax(0, 1fr);
}

@media (max-width: 760px) {
  .import-review-current-automation__summary {
    flex-direction: column;
    align-items: flex-start;
  }

  .import-review-current-automation__heading,
  .import-review-current-automation__state {
    width: 100%;
  }

  .import-review-current-automation__handoff {
    align-items: flex-start;
  }

  .import-review-current-automation__handoff {
    flex-direction: column;
  }

  .import-review-current-automation__state {
    text-align: left;
  }

  .import-review-current-automation__details {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
