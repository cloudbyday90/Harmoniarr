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
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import { RouterLink } from 'vue-router';
import EmptyState from '../EmptyState.vue';
import GridControls from '../GridControls.vue';
import MusicQueueProviderRepairNotice from '../music-queue/MusicQueueProviderRepairNotice.vue';
import MusicQueueProgressStrip from '../music-queue/MusicQueueProgressStrip.vue';
import OperatorArtistCard from './OperatorArtistCard.vue';
import { useDiscoverArtistArtwork } from '../../composables/useDiscoverArtistArtwork.js';
import { useArtworkGridRoving } from '../../composables/useArtworkGridRoving.js';
import { useGridState } from '../../composables/useGridState.js';
import { useOperatorMonitoredArtists } from '../../composables/useOperatorMonitoredArtists.js';
import { useMusicQueue } from '../../composables/useMusicQueue.js';
import { useMusicQueueProviderRepairContext } from '../../composables/useMusicQueueProviderRepairContext.js';
import {
  buildOperatorHomeStats,
  calculateOperatorArtistCoveragePercent,
} from '../../lib/operator-artist-card-presentation.js';
import { hasMusicQueueProviderDependentWork } from '../../lib/music-queue-provider-repair-presentation.js';
import { hasMusicQueueHomeProgress } from '../../lib/music-queue-progress-state.js';
import { SETTINGS_RECOVERY_CONTEXT } from '../../lib/settings-recovery-handoff.js';

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'coverage', label: 'Coverage' },
  { value: 'activity', label: 'Activity' },
];

const OPERATOR_HOME_DEFAULTS = {
  sort: { field: 'name', order: 'asc' },
  filters: {},
};

const dashboardRecoveryContext = Object.freeze({
  context: SETTINGS_RECOVERY_CONTEXT.DASHBOARD,
});

const {
  artists,
  attachVisibilityListener,
  destroy,
  errorMessage,
  isLoading,
  isRevalidating,
  loadOperatorMonitoredArtists,
} = useOperatorMonitoredArtists({
  limit: 50,
  pollIntervalMs: 30000,
  revalidateOnFocus: true,
});

const {
  clearAll,
  filterState,
  isDefault,
  updateState,
} = useGridState(OPERATOR_HOME_DEFAULTS, {
  filterGroupKeys: [],
  filterGroups: [],
  restoreKey: 'operator-home-artists',
  sortOptions: SORT_OPTIONS,
});

const hasArtists = computed(() => artists.value.length > 0);
const artworkArtists = computed(() => artists.value
  .map((projection) => ({
    id: projection.artist?.musicBrainzArtistId ?? null,
    name: projection.artist?.name ?? '',
  }))
  .filter((artist) => artist.id));

const {
  getArtistArtwork,
  isResolvingArtistArtwork,
} = useDiscoverArtistArtwork({
  artistSources: [artworkArtists],
});

const statCards = computed(() => buildOperatorHomeStats(artists.value));

const {
  errorMessage: musicQueueErrorMessage,
  isLoading: isMusicQueueLoading,
  load: loadMusicQueue,
  releases: musicQueueReleases,
} = useMusicQueue({
  limit: 100,
  pollIntervalMs: 30000,
});

const hasProviderDependentMusicQueueWork = computed(() =>
  hasMusicQueueProviderDependentWork(musicQueueReleases.value),
);

const {
  notice: musicQueueProviderRepairNotice,
  refreshProviderRepairContext,
} = useMusicQueueProviderRepairContext({
  enabled: hasProviderDependentMusicQueueWork,
});

const shouldShowMusicQueueProgress = computed(() =>
  isMusicQueueLoading.value
  || hasMusicQueueHomeProgress(musicQueueReleases.value)
  || Boolean(musicQueueErrorMessage.value),
);

const sortedArtists = computed(() => {
  const field = filterState.value?.sort?.field ?? 'name';
  const order = filterState.value?.sort?.order ?? 'asc';
  const direction = order === 'desc' ? -1 : 1;

  return [...artists.value].sort((left, right) => {
    let leftValue;
    let rightValue;

    if (field === 'coverage') {
      leftValue = calculateOperatorArtistCoveragePercent(left.operator?.coverage);
      rightValue = calculateOperatorArtistCoveragePercent(right.operator?.coverage);
    } else if (field === 'activity') {
      leftValue = left.operator?.coverage?.lastReconciledAt
        ?? left.operator?.monitoring?.lastReconciledAt
        ?? left.operator?.monitoring?.lastSavedSnapshotAt
        ?? '';
      rightValue = right.operator?.coverage?.lastReconciledAt
        ?? right.operator?.monitoring?.lastReconciledAt
        ?? right.operator?.monitoring?.lastSavedSnapshotAt
        ?? '';
    } else {
      leftValue = (left.artist?.sortName ?? left.artist?.name ?? '').toLowerCase();
      rightValue = (right.artist?.sortName ?? right.artist?.name ?? '').toLowerCase();
    }

    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return direction;
    return (left.artist?.name ?? '').localeCompare(right.artist?.name ?? '');
  });
});

// Roving tabindex over the monitored-artists grid + the trailing "discover
// more" card (one tab stop; arrows move focus across both).
const artistsGridEl = useTemplateRef('artistsGrid');
useArtworkGridRoving(() => artistsGridEl.value, {
  cellSelector: '.hx-media-card__link-area, .operator-home__discover-card',
  count: () => sortedArtists.value.length,
});

async function refreshAll() {
  await Promise.all([
    loadOperatorMonitoredArtists(),
    loadMusicQueue(),
  ]);
  await refreshProviderRepairContext();
}

onMounted(() => {
  void loadOperatorMonitoredArtists();
  attachVisibilityListener();
});

onBeforeUnmount(() => {
  destroy();
});
</script>

<template>
  <section class="hx-page operator-home">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Home</h1>
        <p class="hx-page-subtitle">
          Your monitored artists power release tracking, wanted automation, and Discover recommendations.
        </p>
      </div>
      <div class="hx-page-actions">
        <RouterLink :to="{ name: 'discover' }" class="hx-btn" data-variant="primary">
          Add artists
        </RouterLink>
        <button
          type="button"
          class="hx-btn"
          :disabled="isLoading || isRevalidating"
          @click="refreshAll"
        >
          {{ isLoading || isRevalidating ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>
    </header>

    <p
      v-if="isLoading && !hasArtists"
      class="operator-home__loading"
      aria-live="polite"
      aria-busy="true"
    >
      Loading monitored artists...
    </p>

    <EmptyState
      v-else-if="errorMessage"
      :title="errorMessage"
      body="Check the server connection and try refreshing this Home view."
      cta-label="Retry"
      @cta-click="refreshAll"
    />

    <EmptyState
      v-else-if="!isLoading && !hasArtists"
      title="No monitored artists yet"
      body="Add artists from Discover to start building the monitored profile that drives release tracking and recommendations."
      cta-label="Add artists"
      :cta-to="{ name: 'discover' }"
      variant="discover"
    />

    <template v-else>
      <section class="hx-stat-grid" aria-label="Monitored artist summary">
        <article v-for="card in statCards" :key="card.label" class="hx-stat-card">
          <span class="hx-stat-label">{{ card.label }}</span>
          <span class="hx-stat-value">{{ card.value }}</span>
          <span class="hx-stat-meta">{{ card.meta }}</span>
        </article>
      </section>

      <MusicQueueProviderRepairNotice
        :notice="musicQueueProviderRepairNotice"
        :return-context="dashboardRecoveryContext"
      />

      <MusicQueueProgressStrip
        v-if="shouldShowMusicQueueProgress"
        active-or-attention-only
        :error-message="musicQueueErrorMessage"
        :is-loading="isMusicQueueLoading"
        :releases="musicQueueReleases"
        release-details-only
      />

      <article class="hx-card operator-home__artists-card">
        <header class="hx-card-header">
          <div>
            <h2 class="hx-card-title">Monitored Artists</h2>
            <p class="hx-card-subtitle">
              Compact policy, coverage, and reconciliation state for the artists you manage.
            </p>
          </div>
        </header>

        <div class="hx-card-body operator-home__controls">
          <GridControls
            :model-value="filterState"
            :sort-options="SORT_OPTIONS"
            :filter-groups="[]"
            :is-default="isDefault"
            :is-loading="isRevalidating || isResolvingArtistArtwork"
            @clear-all="clearAll"
            @update:model-value="updateState"
          />
        </div>

        <div
          class="hx-card-body hx-card-body--flush"
          :class="{ 'operator-home__grid--stale': isRevalidating }"
        >
          <ul
            ref="artistsGrid"
            class="hx-artwork-grid operator-home__grid"
            role="list"
            aria-label="Monitored artists"
          >
            <li v-for="projection in sortedArtists" :key="projection.artist?.id">
              <OperatorArtistCard
                :projection="projection"
                :artwork="getArtistArtwork(projection.artist?.musicBrainzArtistId)"
              />
            </li>

            <li>
              <RouterLink
                :to="{ name: 'discover' }"
                class="hx-media-card operator-home__discover-card"
                aria-label="Add more artists from Discover"
              >
                <div
                  class="hx-artwork hx-artwork--dashed operator-home__discover-art"
                  aria-hidden="true"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div class="hx-media-card__body">
                  <p class="hx-media-card__title">Add more artists</p>
                  <p class="hx-media-card__meta">Search Discover</p>
                </div>
              </RouterLink>
            </li>
          </ul>
        </div>
      </article>
    </template>
  </section>
</template>

<style scoped>
.operator-home {
  display: grid;
  gap: var(--hx-space-5);
  align-content: start;
}

.operator-home__loading {
  margin: 0;
  padding: var(--hx-space-6) 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  text-align: center;
}

.operator-home__artists-card {
  min-width: 0;
}

.operator-home__controls {
  padding-bottom: 0;
}

.operator-home__grid {
  --hx-artwork-grid-min: 196px;
  padding: var(--hx-space-4);
}

.operator-home__grid--stale {
  opacity: 0.68;
  transition: opacity 0.15s ease;
}

.operator-home__discover-card {
  color: inherit;
  text-decoration: none;
}

.operator-home__discover-card:hover .operator-home__discover-art,
.operator-home__discover-card:focus-visible .operator-home__discover-art {
  color: var(--hx-accent);
  border-color: var(--hx-accent);
}

/* Clear perimeter focus ring on the roving cell (WCAG 2.2 §2.4.11); the
   art-color change above remains as an enhancement. */
.operator-home__discover-card:focus-visible {
  outline: 2px solid var(--hx-accent);
  outline-offset: 2px;
  border-radius: var(--hx-radius-lg);
}

.operator-home__discover-art {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hx-text-muted);
}

.operator-home__discover-art svg {
  width: 40%;
  height: 40%;
}

@media (max-width: 640px) {
  .operator-home__grid {
    --hx-artwork-grid-min: 140px;
    padding: var(--hx-space-3);
  }
}
</style>
