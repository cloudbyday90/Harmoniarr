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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ArtworkImage from '../components/ArtworkImage.vue';
import EmptyState from '../components/EmptyState.vue';
import GridControls from '../components/GridControls.vue';
import ReleaseCard from '../components/media/ReleaseCard.vue';
import ReleaseDetailModal from '../components/media/ReleaseDetailModal.vue';
import { useArtworkBatchResolve } from '../composables/useArtworkBatchResolve.js';
import { useGridState } from '../composables/useGridState.js';
import { useLibraryFilterOptions } from '../composables/useLibraryFilterOptions.js';
import { useLibraryReleases } from '../composables/useLibraryReleases.js';
import {
  buildReleaseArtworkRequests,
  getPreferredReleaseArtwork,
} from '../lib/release-artwork-resolve.js';
import {
  LIBRARY_DISPLAY_MODE_OPTIONS,
  readLibraryDisplayModePreference,
  writeLibraryDisplayModePreference,
} from '../lib/library-display-preference.js';
import {
  buildLibraryDuplicateReviewLocation,
  buildLibraryNeedsAttention,
  buildLibraryPageSubtitle,
  buildLibraryReleasesCardSubtitle,
  buildLibraryStatCards,
  formatLibraryDuplicateFileCount,
  formatLibraryTrackCounts,
  formatRemainingTrackRequestLabel,
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

const FILTER_GROUP_KEYS = ['status', 'format'];

const LIBRARY_DEFAULTS = {
  sort: { field: 'artist', order: 'asc' },
  filters: {},
};

const DUPLICATES_EXPANDED_STORAGE_KEY = 'harmoniarr:library:duplicates-expanded:v1';

// ── Dynamic filter options (60s background poll) ──────────────────────────────

const { options: dynamicFilterOptions, load: loadFilterOptions, attachVisibilityListener: attachFilterVisibility, destroy: destroyFilterOptions } = useLibraryFilterOptions({ revalidateOnFocus: true });

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

// ── Grid state (URL-synced) ───────────────────────────────────────────────────

const {
  clearAll,
  filterState,
  isDefault,
  updateState,
} = useGridState(LIBRARY_DEFAULTS, {
  filterGroupKeys: FILTER_GROUP_KEYS,
  restoreKey: 'library',
  sortOptions: SORT_OPTIONS,
  filterGroups,
});

// ── Library releases (server-side, SWR) ──────────────────────────────────────

const library = useLibraryReleases({ filterState, revalidateOnFocus: true });

// ── Normalised releases for ReleaseCard ───────────────────────────────────────

const displayReleases = computed(() =>
  (library.isLoading.value && !library.isFirstLoad.value
    ? library.staleData.value
    : library.data.value
  ).map(normalizeLibraryReleaseForCard),
);

const { getResolved: getResolvedArtwork, resolve: resolveArtworkBatch } = useArtworkBatchResolve();

function readDuplicateReviewExpandedPreference() {
  try {
    return globalThis.localStorage?.getItem(DUPLICATES_EXPANDED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

const libraryGridCard = ref(null);
const duplicateReviewExpanded = ref(readDuplicateReviewExpandedPreference());
const displayMode = ref(readLibraryDisplayModePreference());
const detailModalOpen = ref(false);
const detailRelease = ref(null);

const displayModeOptions = LIBRARY_DISPLAY_MODE_OPTIONS;
const needsAttention = computed(() => buildLibraryNeedsAttention(displayReleases.value));

function getReleaseArtwork(release) {
  return getPreferredReleaseArtwork(getResolvedArtwork, release);
}

function getReleaseArtworkMbid(release) {
  return release?.musicbrainzReleaseId ?? release?.releaseGroupId ?? null;
}

function getReleaseArtworkMbidType(release) {
  return release?.musicbrainzReleaseId ? 'release' : 'release-group';
}

function openPartialReleaseDetail(release) {
  if (!release?.releaseGroupId) {
    return;
  }

  detailRelease.value = release;
  detailModalOpen.value = true;
}

function closeDetailModal() {
  detailModalOpen.value = false;
  detailRelease.value = null;
}

async function showPartialGrid() {
  updateState({
    ...filterState.value,
    filters: {
      ...filterState.value.filters,
      status: 'partial',
    },
  });
  await nextTick();
  libraryGridCard.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(() => {
  attachFilterVisibility();
  library.attachVisibilityListener();
  void loadFilterOptions();
});

onBeforeUnmount(() => {
  library.destroy();
  destroyFilterOptions();
});

watch(
  displayReleases,
  (releases) => {
    void resolveArtworkBatch(buildReleaseArtworkRequests(releases));
  },
  { immediate: true },
);

watch(
  duplicateReviewExpanded,
  (isExpanded) => {
    try {
      globalThis.localStorage?.setItem(DUPLICATES_EXPANDED_STORAGE_KEY, isExpanded ? 'true' : 'false');
    } catch {
      // Local UI preference only; failure should not affect Library rendering.
    }
  },
);

watch(
  displayMode,
  (mode) => {
    const normalizedMode = writeLibraryDisplayModePreference(mode);
    if (normalizedMode !== mode) {
      displayMode.value = normalizedMode;
    }
  },
);

// ── Stats (computed from current data) ────────────────────────────────────────

const totalCount = computed(() => library.totalCount.value);

const statCards = computed(() =>
  buildLibraryStatCards(
    library.totalCount.value,
    library.completeReleases.value.length,
    library.partialReleases.value.length,
    library.duplicateReleases.value.length,
  ),
);

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
        <p class="hx-page-subtitle">{{ buildLibraryPageSubtitle() }}</p>
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
      <article class="hx-stat-card" v-for="card in statCards" :key="card.label">
        <span class="hx-stat-label">{{ card.label }}</span>
        <span class="hx-stat-value">{{ card.value }}</span>
        <span class="hx-stat-meta">{{ card.meta }}</span>
      </article>
    </section>

    <section
      v-if="needsAttention.hasAttention"
      class="library-needs-attention"
      aria-labelledby="library-needs-attention-title"
    >
      <header class="library-needs-attention__header">
        <div>
          <h2 id="library-needs-attention-title" class="library-needs-attention__title">Needs Attention</h2>
          <p class="library-needs-attention__subtitle">
            Complete partial releases or review duplicate files from one place.
          </p>
        </div>
      </header>

      <article v-if="needsAttention.partialReleases.length > 0" class="hx-card library-attention-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Complete your collection</h3>
            <p class="hx-card-subtitle">Partial releases with requestable missing tracks.</p>
          </div>
          <div v-if="needsAttention.partialOverflowCount > 0" class="hx-card-actions">
            <button type="button" class="hx-btn hx-btn--sm" @click="showPartialGrid">
              + {{ needsAttention.partialOverflowCount }} more
            </button>
          </div>
        </header>
        <div class="hx-card-body hx-card-body--flush">
          <div class="library-partial-strip" aria-label="Partial releases">
            <ReleaseCard
              v-for="release in needsAttention.partialReleases"
              :key="release.musicbrainzReleaseId ?? release.releaseGroupId ?? release.title"
              :release="release"
              :requestable="false"
              :local-src="getReleaseArtwork(release)?.url ?? null"
              :dominant-color="getReleaseArtwork(release)?.dominantColor ?? null"
              :artwork-asset-id="getReleaseArtwork(release)?.assetId ?? null"
              @detail="openPartialReleaseDetail"
            >
              <template #actions>
                <div class="hx-library-card-actions">
                  <span class="hx-text-muted">{{ formatLibraryTrackCounts(release) }}</span>
                  <button
                    type="button"
                    class="hx-btn hx-btn--sm"
                    data-variant="primary"
                    @click="openPartialReleaseDetail(release)"
                  >
                    {{ formatRemainingTrackRequestLabel(release) }}
                  </button>
                </div>
              </template>
            </ReleaseCard>
          </div>
        </div>
      </article>

      <article v-if="needsAttention.duplicateReleases.length > 0" class="hx-card library-attention-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Duplicates to review</h3>
            <p class="hx-card-subtitle">
              {{ needsAttention.duplicateReleases.length }}
              {{ needsAttention.duplicateReleases.length === 1 ? 'release' : 'releases' }} with duplicate files.
            </p>
          </div>
          <div class="hx-card-actions">
            <button
              type="button"
              class="hx-btn hx-btn--sm"
              :aria-expanded="duplicateReviewExpanded"
              aria-controls="library-duplicate-review-list"
              @click="duplicateReviewExpanded = !duplicateReviewExpanded"
            >
              {{ duplicateReviewExpanded ? 'Hide duplicates' : 'Review duplicates' }}
            </button>
          </div>
        </header>
        <div
          v-if="duplicateReviewExpanded"
          id="library-duplicate-review-list"
          class="hx-card-body hx-card-body--flush"
        >
          <ul class="library-duplicate-list" aria-label="Duplicate releases">
            <li
              v-for="release in needsAttention.duplicateReleases"
              :key="release.metadataReleaseGroupId ?? release.musicbrainzReleaseId ?? release.title"
              class="library-duplicate-row"
            >
              <div class="library-duplicate-row__main">
                <span class="library-duplicate-row__title">{{ release.title }}</span>
                <span class="library-duplicate-row__meta">
                  {{ release.artistCredit }} · {{ formatLibraryDuplicateFileCount(release) }}
                </span>
              </div>
              <RouterLink
                v-if="buildLibraryDuplicateReviewLocation(release)"
                class="hx-link"
                :to="buildLibraryDuplicateReviewLocation(release)"
              >
                Review files
              </RouterLink>
              <span v-else class="hx-text-muted">Missing metadata link</span>
            </li>
          </ul>
        </div>
      </article>
    </section>

    <!-- Card grid with GridControls -->
    <article ref="libraryGridCard" class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Releases</h2>
          <p v-if="buildLibraryReleasesCardSubtitle(totalCount)" class="hx-card-subtitle">
            {{ buildLibraryReleasesCardSubtitle(totalCount) }}
          </p>
        </div>
      </header>

      <!-- GridControls bar -->
      <div class="hx-card-body library-controls-bar">
        <div class="library-controls-row">
          <GridControls
            :model-value="gridControlsValue"
            :sort-options="SORT_OPTIONS"
            :filter-groups="filterGroups"
            :is-default="isDefault"
            :is-loading="library.isLoading.value && !library.isFirstLoad.value"
            @clear-all="clearAll"
            @update:model-value="onGridControlsUpdate"
          />

          <fieldset class="library-display-mode-toggle">
            <legend class="library-sr-only">Display mode</legend>
            <label
              v-for="option in displayModeOptions"
              :key="option.value"
              class="library-display-mode-option"
              :data-active="displayMode === option.value ? 'true' : 'false'"
            >
              <input
                v-model="displayMode"
                type="radio"
                name="library-display-mode"
                :value="option.value"
              />
              <span>{{ option.label }}</span>
            </label>
          </fieldset>
        </div>

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
        id="library-release-results"
        class="hx-card-body hx-card-body--flush"
        :class="{ 'library-grid--stale': library.isLoading.value && !library.isFirstLoad.value }"
      >
        <div v-if="displayMode === 'grid'" class="hx-artwork-grid">
          <ReleaseCard
            v-for="(release, index) in displayReleases"
            :key="library.data.value[index]?.id ?? library.staleData.value[index]?.id ?? index"
            :release="release"
            :requestable="false"
            :local-src="getReleaseArtwork(release)?.url ?? null"
            :dominant-color="getReleaseArtwork(release)?.dominantColor ?? null"
            :artwork-asset-id="getReleaseArtwork(release)?.assetId ?? null"
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

        <div v-else class="library-release-list" role="list" aria-label="Library releases">
          <article
            v-for="(release, index) in displayReleases"
            :key="library.data.value[index]?.id ?? library.staleData.value[index]?.id ?? index"
            class="library-release-row"
            role="listitem"
          >
            <div class="library-release-row__artwork">
              <ArtworkImage
                :mbid="getReleaseArtworkMbid(release)"
                :mbid-type="getReleaseArtworkMbidType(release)"
                :local-src="getReleaseArtwork(release)?.url ?? null"
                :alt="release.title ? `${release.title} artwork` : 'Release artwork'"
              />
            </div>

            <div class="library-release-row__main">
              <h3 class="library-release-row__title">{{ release.title ?? 'Untitled release' }}</h3>
              <p class="library-release-row__artist">{{ release.artistCredit ?? 'Unknown artist' }}</p>
              <p class="library-release-row__meta">
                <span v-if="release.date">{{ release.date }}</span>
                <span v-if="release.date && release.releaseGroup?.primaryType"> · </span>
                <span v-if="release.releaseGroup?.primaryType">{{ release.releaseGroup.primaryType }}</span>
              </p>
            </div>

            <dl class="library-release-row__facts">
              <div class="library-release-row__fact">
                <dt>Status</dt>
                <dd>
                  <span
                    class="hx-pill"
                    :data-tone="getReconciliationStatusTone(release.reconciliationStatus)"
                  >
                    {{ getReconciliationStatusLabel(release.reconciliationStatus) }}
                  </span>
                </dd>
              </div>
              <div
                v-if="formatLibraryTrackCounts(release)"
                class="library-release-row__fact"
              >
                <dt>Tracks</dt>
                <dd>{{ formatLibraryTrackCounts(release) }}</dd>
              </div>
              <div
                v-if="release.reconciliationStatus === 'duplicate'"
                class="library-release-row__fact"
              >
                <dt>Duplicates</dt>
                <dd>{{ formatLibraryDuplicateFileCount(release) }}</dd>
              </div>
            </dl>
          </article>
        </div>
      </div>
    </article>

    <ReleaseDetailModal
      v-if="detailRelease"
      :open="detailModalOpen"
      :release-group-mbid="detailRelease?.releaseGroupId ?? ''"
      :release-group-id="detailRelease?.metadataReleaseGroupId ?? null"
      :release-title="detailRelease?.title ?? null"
      :artist-name="detailRelease?.artistCredit ?? null"
      :release-year="detailRelease?.date ? String(detailRelease.date).slice(0, 4) : null"
      :artwork-url="getReleaseArtwork(detailRelease)?.url ?? null"
      :prefer-release-mbid="detailRelease?.musicbrainzReleaseId ?? null"
      @close="closeDetailModal"
      @requested="closeDetailModal"
    />
  </section>
</template>

<style scoped>
.library-controls-bar {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-2);
}

.library-controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-3);
  flex-wrap: wrap;
}

.library-controls-row > :first-child {
  flex: 1 1 420px;
  min-width: 0;
}

.library-display-mode-toggle {
  display: inline-flex;
  align-items: stretch;
  flex: 0 0 auto;
  margin: 0;
  padding: 2px;
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-sm);
  background: var(--hx-bg-surface-sunken);
}

.library-display-mode-option {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  min-height: 30px;
  padding: 0 var(--hx-space-3);
  border-radius: var(--hx-radius-xs);
  color: var(--hx-text-muted);
  cursor: pointer;
  font-size: var(--hx-text-sm);
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  transition: background 0.12s, color 0.12s, box-shadow 0.12s;
}

.library-display-mode-option[data-active='true'] {
  background: var(--hx-bg-surface);
  box-shadow: var(--hx-shadow-sm);
  color: var(--hx-text-strong);
}

.library-display-mode-option input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.library-display-mode-option:focus-within {
  outline: 2px solid var(--hx-accent);
  outline-offset: 2px;
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

.library-release-list {
  display: grid;
}

.library-release-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) minmax(220px, auto);
  align-items: center;
  gap: var(--hx-space-3);
  min-height: 88px;
  padding: var(--hx-space-3) var(--hx-space-4);
  border-top: 1px solid var(--hx-border-subtle);
}

.library-release-row:first-child {
  border-top: 0;
}

.library-release-row__artwork {
  width: 64px;
  min-width: 64px;
}

.library-release-row__main {
  display: grid;
  min-width: 0;
  gap: var(--hx-space-1);
}

.library-release-row__title {
  overflow: hidden;
  margin: 0;
  color: var(--hx-text-strong);
  font-size: var(--hx-text-base);
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-release-row__artist,
.library-release-row__meta {
  overflow: hidden;
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-release-row__facts {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--hx-space-3);
  min-width: 0;
  margin: 0;
}

.library-release-row__fact {
  display: grid;
  gap: var(--hx-space-1);
  justify-items: end;
  min-width: max-content;
}

.library-release-row__fact dt {
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
}

.library-release-row__fact dd {
  margin: 0;
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
  line-height: 1.2;
  white-space: nowrap;
}

.library-needs-attention {
  display: grid;
  gap: var(--hx-space-3);
}

.library-needs-attention__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--hx-space-3);
}

.library-needs-attention__title {
  margin: 0;
  color: var(--hx-text-strong);
  font-size: var(--hx-text-lg);
  line-height: 1.2;
}

.library-needs-attention__subtitle {
  margin: var(--hx-space-1) 0 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.library-attention-card {
  overflow: hidden;
}

.library-partial-strip {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(180px, 210px);
  gap: var(--hx-space-3);
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  padding: var(--hx-space-4);
  scroll-snap-type: inline proximity;
}

.library-partial-strip > * {
  min-width: 0;
  scroll-snap-align: start;
}

.library-duplicate-list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.library-duplicate-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--hx-space-3);
  padding: var(--hx-space-3) var(--hx-space-4);
  border-top: 1px solid var(--hx-border-subtle);
}

.library-duplicate-row:first-child {
  border-top: 0;
}

.library-duplicate-row__main {
  display: grid;
  min-width: 0;
  gap: var(--hx-space-1);
}

.library-duplicate-row__title {
  overflow: hidden;
  color: var(--hx-text-strong);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-duplicate-row__meta {
  overflow: hidden;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
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
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.library-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 640px) {
  .library-display-mode-toggle {
    width: 100%;
  }

  .library-display-mode-option {
    flex: 1 1 0;
  }

  .library-release-row {
    grid-template-columns: 56px minmax(0, 1fr);
    align-items: start;
    min-height: 0;
  }

  .library-release-row__artwork {
    width: 56px;
    min-width: 56px;
  }

  .library-release-row__facts {
    grid-column: 1 / -1;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .library-release-row__fact {
    justify-items: start;
  }

  .library-partial-strip {
    grid-auto-columns: minmax(164px, 78vw);
  }

  .library-duplicate-row {
    grid-template-columns: 1fr;
    align-items: start;
  }
}
</style>
