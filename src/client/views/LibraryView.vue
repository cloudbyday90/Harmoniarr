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
import { computed, onMounted, ref } from 'vue';
import EmptyState from '../components/EmptyState.vue';
import ReleaseCard from '../components/media/ReleaseCard.vue';
import { useLibraryReleases } from '../composables/useLibraryReleases.js';
import {
  formatLibraryTrackCounts,
  getReconciliationStatusLabel,
  getReconciliationStatusTone,
  normalizeLibraryReleaseForCard,
} from '../lib/library-release-normalization.js';

const library = useLibraryReleases();

// ── Filter state ──────────────────────────────────────────────────────────────

/** 'all' | 'complete' | 'partial' | 'duplicate' */
const activeFilter = ref('all');

const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'complete', label: 'In Library' },
  { value: 'partial', label: 'Partial' },
  { value: 'duplicate', label: 'Duplicate' },
];

function applyFilter(value) {
  if (activeFilter.value === value) return;
  activeFilter.value = value;
  library.loadReleases({ reconciliationStatus: value === 'all' ? null : value });
}

// ── Normalised releases for ReleaseCard ───────────────────────────────────────

const normalizedReleases = computed(() =>
  library.releases.value.map(normalizeLibraryReleaseForCard),
);

// ── Stats computed from full (all-filter) response ───────────────────────────

const completeCount = computed(() => library.completeReleases.value.length);
const partialCount = computed(() => library.partialReleases.value.length);
const duplicateCount = computed(() => library.duplicateReleases.value.length);

// ── Lifecycle ─────────────────────────────────────────────────────────────────

function refreshAll() {
  library.loadReleases({ reconciliationStatus: activeFilter.value === 'all' ? null : activeFilter.value });
}

onMounted(() => {
  library.loadReleases();
});
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

    <article v-if="library.errorMessage.value" class="hx-card">
      <div class="hx-card-body">
        <span class="hx-pill" data-tone="danger">{{ library.errorMessage.value }}</span>
      </div>
    </article>

    <!-- Stats grid — skeleton while loading, populated after first load -->
    <section class="hx-stat-grid" v-if="library.isLoading.value && !library.releases.value.length">
      <article class="hx-stat-card" v-for="i in 4" :key="i">
        <span class="hx-skeleton" data-size="sm" style="width: 60%"></span>
        <span class="hx-skeleton" data-size="lg" style="width: 40%"></span>
        <span class="hx-skeleton" data-size="sm" style="width: 75%"></span>
      </article>
    </section>

    <section class="hx-stat-grid" v-else-if="library.totalCount.value > 0 || !library.isLoading.value">
      <article class="hx-stat-card">
        <span class="hx-stat-label">Total releases</span>
        <span class="hx-stat-value">{{ library.totalCount.value }}</span>
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

    <!-- Card grid with filter -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Releases</h2>
          <p class="hx-card-subtitle">
            {{ library.totalCount.value }} release{{ library.totalCount.value === 1 ? '' : 's' }}
          </p>
        </div>
        <div class="hx-card-actions">
          <div class="hx-filter-tabs" role="group" aria-label="Filter by reconciliation status">
            <button
              v-for="option in filterOptions"
              :key="option.value"
              type="button"
              class="hx-filter-tab"
              :class="{ 'is-active': activeFilter === option.value }"
              :aria-pressed="activeFilter === option.value"
              @click="applyFilter(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </header>

      <div class="hx-card-body" v-if="library.isLoading.value && normalizedReleases.length === 0">
        <div class="hx-skeleton-stack">
          <span class="hx-skeleton" v-for="i in 6" :key="i"></span>
        </div>
      </div>

      <div class="hx-card-body" v-else-if="normalizedReleases.length === 0 && !library.isLoading.value">
        <EmptyState
          v-if="activeFilter === 'all'"
          title="No library releases yet"
          body="Once you've run a library scan and reconciliation, your acquired releases will appear here."
          variant="default"
        />
        <EmptyState
          v-else-if="activeFilter === 'complete'"
          title="No fully acquired releases"
          body="Releases become 'In Library' once all expected tracks are matched."
          variant="default"
        />
        <EmptyState
          v-else-if="activeFilter === 'partial'"
          title="No partial releases"
          body="Releases are partial when only some expected tracks are present."
          variant="default"
        />
        <EmptyState
          v-else
          title="No duplicate releases"
          body="Duplicate releases are detected when multiple files match the same track."
          variant="default"
        />
      </div>

      <div v-else class="hx-card-body hx-card-body--flush">
        <div class="hx-artwork-grid">
          <ReleaseCard
            v-for="(release, index) in normalizedReleases"
            :key="library.releases.value[index]?.id ?? index"
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
.hx-filter-tabs {
  display: flex;
  gap: var(--hx-space-1);
  background: var(--hx-bg-raised);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius);
  padding: 2px;
}

.hx-filter-tab {
  padding: var(--hx-space-1) var(--hx-space-3);
  border: none;
  border-radius: calc(var(--hx-radius) - 2px);
  background: transparent;
  color: var(--hx-text-secondary);
  font-size: var(--hx-font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}

.hx-filter-tab:hover {
  background: var(--hx-bg-hover);
  color: var(--hx-text);
}

.hx-filter-tab.is-active {
  background: var(--hx-bg-surface);
  color: var(--hx-text);
  box-shadow: var(--hx-shadow-xs);
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
