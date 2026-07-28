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
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MusicQueueEmptyState from '../components/music-queue/MusicQueueEmptyState.vue';
import MusicQueueProviderRepairNotice from '../components/music-queue/MusicQueueProviderRepairNotice.vue';
import MusicQueueProviderRecoveryVisibility from '../components/music-queue/MusicQueueProviderRecoveryVisibility.vue';
import MusicQueueReviewPanel from '../components/music-queue/MusicQueueReviewPanel.vue';
import MusicQueueReleaseRow from '../components/music-queue/MusicQueueReleaseRow.vue';
import {
  buildMusicQueueMatchReview,
  buildMusicQueueReleaseTypeFilters,
  filterMusicQueueReleases,
  MUSIC_QUEUE_SCOPE_FILTERS,
  MUSIC_QUEUE_STATE_FILTERS,
} from '../lib/acquisition-pipeline-presentation.js';
import { useMusicQueue } from '../composables/useMusicQueue.js';
import { useMusicQueueProviderRepairContext } from '../composables/useMusicQueueProviderRepairContext.js';
import { hasMusicQueueProviderDependentWork } from '../lib/music-queue-provider-repair-presentation.js';
import { buildMusicQueueStatusPresentation } from '../lib/music-queue-status-presentation.js';
import {
  buildMusicQueueProviderRecoveryVisibility,
  isMusicQueueProviderReadyRecoveryContext,
  omitMusicQueueProviderReadyRecoveryQuery,
} from '../lib/music-queue-provider-recovery-visibility-presentation.js';
import { sessionStore } from '../state/session.js';

const route = useRoute();
const router = useRouter();
const isProviderReadyRecoveryReturn = isMusicQueueProviderReadyRecoveryContext(route.query.recovery);

const {
  actionErrorMessage,
  actionMessage,
  activeMatchActionKey,
  activeReleaseActionKey,
  allowFallbackQuality,
  errorMessage,
  isLoading,
  isRevalidating,
  load,
  rejectMatch,
  releases,
  searchAgain,
  summaryCards,
  useMatch,
} = useMusicQueue({ immediate: !isProviderReadyRecoveryReturn });

const isRequester = computed(() => sessionStore.state.user?.role === 'requester');
const hasProviderDependentMusicQueueWork = computed(() =>
  hasMusicQueueProviderDependentWork(releases.value),
);
const shouldCheckProviderRepair = computed(() =>
  !isRequester.value && hasProviderDependentMusicQueueWork.value,
);
const {
  notice: musicQueueProviderRepairNotice,
  refreshProviderRepairContext,
} = useMusicQueueProviderRepairContext({
  enabled: shouldCheckProviderRepair,
});

const query = ref('');
const filtersExpanded = ref(false);
const selectedScope = ref('current');
const selectedState = ref('all');
const selectedReleaseType = ref('all');
const selectedReleaseId = ref(typeof route.params.wantedReleaseId === 'string' ? route.params.wantedReleaseId : null);
const providerRecoveryVisibility = ref(null);

const releaseTypeFilters = computed(() => buildMusicQueueReleaseTypeFilters(releases.value));
const filteredReleases = computed(() => filterMusicQueueReleases(releases.value, {
  query: query.value,
  releaseType: selectedReleaseType.value,
  scope: selectedScope.value,
  state: selectedState.value,
}));
const scopedReleaseCount = computed(() => filterMusicQueueReleases(releases.value, {
  scope: selectedScope.value,
}).length);
const musicQueueStatus = computed(() => buildMusicQueueStatusPresentation(summaryCards.value));
const isCurrentWorkScope = computed(() => selectedScope.value === 'current');
const queueListHeading = computed(() => (
  isCurrentWorkScope.value ? 'Current work' : 'All releases'
));
const hasNarrowingFilters = computed(() => (
  query.value.trim().length > 0
  || selectedState.value !== 'all'
  || selectedReleaseType.value !== 'all'
));
const queueListStatus = computed(() => {
  if (!isCurrentWorkScope.value || hasNarrowingFilters.value) {
    return `${filteredReleases.value.length} of ${scopedReleaseCount.value} release${scopedReleaseCount.value === 1 ? '' : 's'} ${
      isCurrentWorkScope.value ? 'matching the current filters' : 'being tracked'
    }`;
  }

  return musicQueueStatus.value.primaryHeadline;
});
const queueListDetail = computed(() => (
  isCurrentWorkScope.value && !hasNarrowingFilters.value && filteredReleases.value.length > 0
    ? musicQueueStatus.value.primaryDetail
    : ''
));
const scheduledSearchDetail = computed(() => (
  isCurrentWorkScope.value && !hasNarrowingFilters.value && filteredReleases.value.length > 0
    ? musicQueueStatus.value.scheduledSearchDetail
    : ''
));
const hasActiveFilters = computed(() => (
  query.value.trim().length > 0
  || selectedScope.value !== 'current'
  || selectedState.value !== 'all'
  || selectedReleaseType.value !== 'all'
));
const selectedRelease = computed(() => (
  filteredReleases.value.find((release) => release.id === selectedReleaseId.value)
  ?? releases.value.find((release) => release.id === selectedReleaseId.value)
  ?? null
));
const matchReview = computed(() => buildMusicQueueMatchReview(selectedRelease.value));

function openReview(release) {
  selectedReleaseId.value = release.id;
  if (route.name !== 'music-queue-release' || route.params.wantedReleaseId !== release.id) {
    void router.replace({ name: 'music-queue-release', params: { wantedReleaseId: release.id } });
  }
}

function closeReview() {
  selectedReleaseId.value = null;
  if (route.name === 'music-queue-release') {
    void router.replace({ name: 'music-queue' });
  }
}

function clearFilters() {
  query.value = '';
  selectedScope.value = 'current';
  selectedState.value = 'all';
  selectedReleaseType.value = 'all';
  filtersExpanded.value = false;
}

function showScheduledReleases() {
  selectedScope.value = 'all';
  selectedState.value = 'waiting';
  filtersExpanded.value = true;
}

function showAllReleases() {
  selectedScope.value = 'all';
}

async function handleUseMatch(match) {
  await useMatch({
    matchId: match.matchId,
    wantedReleaseId: selectedRelease.value?.id,
  });
}

async function handleRejectMatch(match) {
  await rejectMatch({
    matchId: match.matchId,
    wantedReleaseId: selectedRelease.value?.id,
  });
}

async function handleSearchAgain() {
  await searchAgain({
    wantedReleaseId: selectedRelease.value?.id,
  });
}

async function handleAllowFallbackQuality() {
  await allowFallbackQuality({
    wantedReleaseId: selectedRelease.value?.id,
  });
}

async function refreshMusicQueue() {
  await load();
  await refreshProviderRepairContext();
}

async function consumeProviderReadyRecoveryReturn() {
  if (!isProviderReadyRecoveryReturn) return;

  await refreshMusicQueue();
  providerRecoveryVisibility.value = buildMusicQueueProviderRecoveryVisibility({
    refreshFailed: Boolean(errorMessage.value),
    releases: releases.value,
  });

  await router.replace({
    name: 'music-queue',
    query: omitMusicQueueProviderReadyRecoveryQuery(route.query),
  });
}

onMounted(() => {
  void consumeProviderReadyRecoveryReturn();
});

watch(
  () => route.params.wantedReleaseId,
  (wantedReleaseId) => {
    selectedReleaseId.value = typeof wantedReleaseId === 'string' ? wantedReleaseId : null;
  },
);
</script>

<template>
  <section class="music-queue-view">
    <header class="music-queue-header">
      <div>
        <p class="hx-eyebrow">Music Queue</p>
        <h1>Music Queue</h1>
        <p class="music-queue-copy">
          Releases Harmoniarr is searching, downloading, checking, and adding to your library. If automation stops, the row explains why and shows the next action.
        </p>
      </div>
      <button type="button" class="hx-btn" :disabled="isRevalidating" @click="refreshMusicQueue">
        {{ isRevalidating ? 'Refreshing...' : 'Refresh' }}
      </button>
    </header>

    <MusicQueueProviderRepairNotice
      v-if="!isRequester"
      :notice="musicQueueProviderRepairNotice"
      return-context="music_queue"
    />

    <MusicQueueProviderRecoveryVisibility :visibility="providerRecoveryVisibility" />

    <div v-if="errorMessage" class="hx-alert" data-tone="danger">
      {{ errorMessage }}
    </div>

    <div v-if="actionMessage" class="hx-alert" data-tone="success" role="status">
      {{ actionMessage }}
    </div>

    <div v-if="actionErrorMessage" class="hx-alert" data-tone="danger" role="alert">
      {{ actionErrorMessage }}
    </div>

    <div v-if="isLoading" class="music-queue-panel">
      Loading Music Queue...
    </div>

    <MusicQueueEmptyState v-else-if="!releases.length" />

    <div v-else class="music-queue-layout">
      <div class="music-queue-panel">
        <div class="music-queue-panel-header">
          <div>
            <h2>{{ queueListHeading }}</h2>
            <p class="music-queue-panel-status" role="status" aria-atomic="true">{{ queueListStatus }}</p>
            <p v-if="queueListDetail" class="music-queue-panel-detail">{{ queueListDetail }}</p>
            <p v-if="scheduledSearchDetail" class="music-queue-scheduled-search">
              <span>{{ scheduledSearchDetail }}</span>
              <button type="button" class="hx-btn" data-variant="ghost" @click="showScheduledReleases">
                View scheduled releases
              </button>
            </p>
          </div>
          <div class="music-queue-filters" aria-label="Music Queue filters">
            <label class="music-queue-filter">
              <span>Show</span>
              <select v-model="selectedScope" class="hx-select">
                <option v-for="filter in MUSIC_QUEUE_SCOPE_FILTERS" :key="filter.value" :value="filter.value">
                  {{ filter.label }}
                </option>
              </select>
            </label>
            <label class="music-queue-filter music-queue-filter--search">
              <span>Search</span>
              <input v-model="query" class="hx-input" type="search" placeholder="Artist or release" />
            </label>
            <div class="music-queue-filter-actions">
              <RouterLink class="hx-btn" data-variant="ghost" :to="{ name: 'activity-history' }">
                History
              </RouterLink>
              <button
                type="button"
                class="hx-btn"
                data-variant="ghost"
                aria-controls="music-queue-secondary-filters"
                :aria-expanded="filtersExpanded"
                @click="filtersExpanded = !filtersExpanded"
              >
                {{ hasActiveFilters ? 'Filters active' : 'Filters' }}
              </button>
              <button
                v-if="hasActiveFilters"
                type="button"
                class="hx-btn"
                data-variant="ghost"
                @click="clearFilters"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div v-show="filtersExpanded" id="music-queue-secondary-filters" class="music-queue-secondary-filters">
          <label class="music-queue-filter">
            <span>State</span>
            <select v-model="selectedState" class="hx-select">
              <option v-for="filter in MUSIC_QUEUE_STATE_FILTERS" :key="filter.value" :value="filter.value">
                {{ filter.label }}
              </option>
            </select>
          </label>
          <label class="music-queue-filter">
            <span>Type</span>
            <select v-model="selectedReleaseType" class="hx-select">
              <option v-for="filter in releaseTypeFilters" :key="filter.value" :value="filter.value">
                {{ filter.label }}
              </option>
            </select>
          </label>
        </div>

        <div v-if="!filteredReleases.length" class="music-queue-empty-inline">
          <template v-if="isCurrentWorkScope && !hasActiveFilters">
            <p>No current action is needed.</p>
            <p v-if="musicQueueStatus.scheduledSearchDetail">{{ musicQueueStatus.scheduledSearchDetail }}</p>
            <p v-else>Completed and waiting releases are still available when you need them.</p>
            <button
              type="button"
              class="hx-btn"
              data-variant="ghost"
              @click="musicQueueStatus.scheduledSearchCount ? showScheduledReleases() : showAllReleases()"
            >
              {{ musicQueueStatus.scheduledSearchCount ? 'View scheduled releases' : 'View all releases' }}
            </button>
          </template>
          <template v-else>
            No releases match these filters.
          </template>
        </div>

        <div v-else class="music-queue-list" role="list">
          <MusicQueueReleaseRow
            v-for="release in filteredReleases"
            :key="release.id"
            :release="release"
            :selected="selectedReleaseId === release.id"
            @open-review="openReview"
          />
        </div>
      </div>

      <MusicQueueReviewPanel
        :active-match-action-key="activeMatchActionKey"
        :active-release-action-key="activeReleaseActionKey"
        :review="matchReview"
        @allow-fallback-quality="handleAllowFallbackQuality"
        @close="closeReview"
        @reject-match="handleRejectMatch"
        @search-again="handleSearchAgain"
        @use-match="handleUseMatch"
      />
    </div>
  </section>
</template>

<style scoped>
.music-queue-view {
  display: grid;
  gap: 24px;
  padding: 32px clamp(18px, 4vw, 48px);
}

.music-queue-header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.music-queue-header h1 {
  margin: 0;
}

.music-queue-copy,
.music-queue-panel-status,
.music-queue-panel-detail,
.music-queue-scheduled-search {
  color: var(--hx-text-muted);
}

.music-queue-panel {
  background: var(--hx-bg-surface);
  border: 1px solid var(--hx-border);
  border-radius: 8px;
}

.music-queue-layout {
  align-items: start;
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
}

.music-queue-panel {
  padding: 20px;
}

.music-queue-panel-header {
  align-items: end;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.music-queue-panel-header h2 {
  margin: 0;
}

.music-queue-panel-status,
.music-queue-panel-detail,
.music-queue-scheduled-search {
  font-size: var(--hx-text-sm);
  margin: var(--hx-space-1) 0 0;
}

.music-queue-panel-status {
  color: var(--hx-text);
  font-weight: 700;
}

.music-queue-scheduled-search {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-1);
}

.music-queue-scheduled-search .hx-btn {
  margin: calc(var(--hx-space-1) * -1) 0;
}

.music-queue-filters {
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.music-queue-filter-actions,
.music-queue-secondary-filters {
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

.music-queue-secondary-filters {
  border-top: 1px solid var(--hx-border);
  margin-top: var(--hx-space-3);
  padding-top: var(--hx-space-3);
}

.music-queue-filter {
  display: grid;
  gap: 4px;
}

.music-queue-filter span {
  color: var(--hx-text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.music-queue-filter--search {
  min-width: min(100%, 220px);
}

.music-queue-list {
  display: grid;
}

.music-queue-empty-inline {
  display: grid;
  justify-items: center;
  gap: var(--hx-space-2);
  padding: 48px 20px;
  text-align: center;
}

.music-queue-empty-inline p {
  margin: 0;
}

.music-queue-empty-inline p + p {
  color: var(--hx-text-muted);
}

@media (max-width: 720px) {
  .music-queue-header,
  .music-queue-panel-header {
    align-items: stretch;
    flex-direction: column;
  }

  .music-queue-layout {
    grid-template-columns: 1fr;
  }
}
</style>
