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
import EmptyState from '../components/EmptyState.vue';
import GridControls from '../components/GridControls.vue';
import ReleaseCard from '../components/media/ReleaseCard.vue';
import { useGridState } from '../composables/useGridState.js';
import { useLibraryFilterOptions } from '../composables/useLibraryFilterOptions.js';
import { useLibraryReleases } from '../composables/useLibraryReleases.js';
import {
  formatLibraryTrackCounts,
  getReconciliationStatusLabel,
  getReconciliationStatusTone,
  normalizeLibraryReleaseForCard,
} from '../lib/library-release-normalization.js';

// ── Sort / filter definitions ─────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'artist', label: 'Artist' },
  { value: 'title', label: 'Title' },
  { value: 'date', label: 'Release date' },
  { value: 'added', label: 'Date added' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'complete', label: 'In Library' },
  { value: 'partial', label: 'Partial' },
  { value: 'duplicate', label: 'Duplicate' },
];

const FILTER_GROUP_KEYS = ['status'];

const LIBRARY_DEFAULTS = {
  sort: { field: 'artist', order: 'asc' },
  filters: {},
};

// ── Grid state (URL-synced) ───────────────────────────────────────────────────

const {
  clearAll,
  clearFilter,
  filterState,
  isDefault,
  toggleSortOrder,
  updateState,
} = useGridState(LIBRARY_DEFAULTS, {
  filterGroupKeys: FILTER_GROUP_KEYS,
  restoreKey: 'library',
  sortOptions: SORT_OPTIONS,
  filterGroups: [{ key: 'status', label: 'Status', options: STATUS_FILTER_OPTIONS }],
});

// ── Dynamic filter options (60s background poll) ──────────────────────────────

const { options: dynamicFilterOptions } = useLibraryFilterOptions();

// Merge static status filter group with any dynamic format/genre groups from the server
const filterGroups = computed(() => {
  const groups = [{ key: 'status', label: 'Status', options: STATUS_FILTER_OPTIONS }];
  if (dynamicFilterOptions.value?.formats?.length > 0) {
    groups.push({
      key: 'format',
      label: 'Format',
      options: dynamicFilterOptions.value.formats.map((f) => ({ value: f, label: f.toUpperCase() })),
    });
  }
  return groups;
});

// ── Library releases (server-side, SWR) ──────────────────────────────────────

const library = useLibraryReleases({ filterState });

// ── Normalised releases for ReleaseCard ───────────────────────────────────────

const displayReleases = computed(() =>
  (library.isLoading.value && !library.isFirstLoad.value
    ? library.staleData.value
    : library.data.value
  ).map(normalizeLibraryReleaseForCard),
);

// ── Stats (computed from current data) ────────────────────────────────────────

const completeCount = computed(() => library.completeReleases.value.length);
const partialCount = computed(() => library.partialReleases.value.length);
const duplicateCount = computed(() => library.duplicateReleases.value.length);
const totalCount = computed(() => library.totalCount.value);

// ── GridControls v-model bridge ───────────────────────────────────────────────

const gridControlsValue = computed(() => filterState.value);

function onGridControlsUpdate(newState) {
  updateState(newState);
}

// ── Refresh ────────────────────────────────────────────────────────────────────

function refreshAll() {
  library.retry();
}
</script>

<template>
  <section class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Library</h1>
        <p class="hx-page-subtitle">Your music collection — releases acquired and reconciled with the library.</p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="refreshAll" :disabled="library.isLoading.value">
          {{ library.isLoading.value ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <!-- First-load error state -->
    <article v-if="library.error.value && library.isFirstLoad.value" class="hx-card">
      <div class="hx-card-body">
        <EmptyState
          title="Could not load library"
          :body="library.error.value.message"
          cta-label="Retry"
          @cta-click="refreshAll"
          variant="default"
        />
      </div>
    </article>

    <!-- Stats grid — skeleton while loading, populated after first load -->
    <section class="hx-stat-grid" v-if="library.isFirstLoad.value && library.isLoading.value">
      <article class="hx-stat-card" v-for="i in 4" :key="i">
        <span class="hx-skeleton" data-size="sm" style="width: 60%"></span>
        <span class="hx-skeleton" data-size="lg" style="width: 40%"></span>
        <span class="hx-skeleton" data-size="sm" style="width: 75%"></span>
      </article>
    </section>

    <section class="hx-stat-grid" v-else-if="totalCount > 0 || !library.isLoading.value">
      <article class="hx-stat-card">
        <span class="hx-stat-label">Total releases</span>
        <span class="hx-stat-value">{{ totalCount }}</span>
        <span class="hx-stat-meta">In library or reconciled</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">In Library</span>
        <span class="hx-stat-value">{{ completeCount }}</span>
        <span class="hx-stat-meta">Fully matched</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Partial</span>
        <span class="hx-stat-value">{{ partialCount }}</span>
        <span class="hx-stat-meta">Some tracks missing</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Duplicate</span>
        <span class="hx-stat-value">{{ duplicateCount }}</span>
        <span class="hx-stat-meta">Duplicate files detected</span>
      </article>
    </section>

    <!-- Card grid with GridControls -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Releases</h2>
          <p class="hx-card-subtitle">
            {{ totalCount }} release{{ totalCount === 1 ? '' : 's' }}
          </p>
        </div>
      </header>

      <!-- GridControls bar -->
      <div class="hx-card-body library-controls-bar">
        <GridControls
          :model-value="gridControlsValue"
          :sort-options="SORT_OPTIONS"
          :filter-groups="filterGroups"
          :is-default="isDefault"
          :is-loading="library.isLoading.value && !library.isFirstLoad.value"
          @update:model-value="onGridControlsUpdate"
        />

        <!-- Non-first-load error callout above stale data -->
        <div
          v-if="library.error.value && !library.isFirstLoad.value"
          class="library-error-callout"
          role="alert"
        >
          <span class="hx-pill" data-tone="danger">{{ library.error.value.message }}</span>
          <button type="button" class="hx-btn hx-btn--sm" @click="refreshAll">Retry</button>
        </div>
      </div>

      <!-- First load skeleton -->
      <div class="hx-card-body" v-if="library.isFirstLoad.value && library.isLoading.value">
        <div class="hx-skeleton-stack">
          <span class="hx-skeleton" v-for="i in 6" :key="i"></span>
        </div>
      </div>

      <!-- Empty state -->
      <div
        class="hx-card-body"
        v-else-if="library.isEmpty.value && !library.isLoading.value"
      >
        <EmptyState
          v-if="isDefault"
          title="No library releases yet"
          body="Once you've run a library scan and reconciliation, your acquired releases will appear here."
          variant="default"
        />
        <EmptyState
          v-else
          title="No releases match these filters"
          body="Try adjusting or clearing your filters."
          cta-label="Clear filters"
          @cta-click="clearAll"
          variant="default"
        />
      </div>

      <!-- Release grid — stale at 60% opacity during subsequent loads -->
      <div
        v-else-if="displayReleases.length > 0"
        class="hx-card-body hx-card-body--flush"
        :class="{ 'library-grid--stale': library.isLoading.value && !library.isFirstLoad.value }"
      >
        <div class="hx-artwork-grid">
          <ReleaseCard
            v-for="(release, index) in displayReleases"
            :key="library.data.value[index]?.id ?? library.staleData.value[index]?.id ?? index"
            :release="release"
            :requestable="false"
          >
            <template #actions>
              <div class="hx-library-card-actions">
                <div class="hx-library-card-meta">
                  <span
                    class="hx-pill"
                    :data-tone="getReconciliationStatusTone(release.reconciliationStatus)"
                  >
                    {{ getReconciliationStatusLabel(release.reconciliationStatus) }}
                  </span>
                  <span
                    v-if="formatLibraryTrackCounts(release)"
                    class="hx-text-muted"
                  >
                    {{ formatLibraryTrackCounts(release) }}
                  </span>
                </div>
              </div>
            </template>
          </ReleaseCard>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.library-controls-bar {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-2);
}

.library-error-callout {
  display: flex;
  align-items: center;
  gap: var(--hx-space-3);
  flex-wrap: wrap;
}

.library-grid--stale {
  opacity: 0.6;
  transition: opacity 0.15s;
}

.hx-library-card-actions {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-2);
  width: 100%;
}

.hx-library-card-meta {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

.hx-text-muted {
  font-size: var(--hx-font-size-sm);
  color: var(--hx-text-secondary);
}
</style>
