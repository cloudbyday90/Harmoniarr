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
} from '../lib/acquisition-pipeline-presentation.js';
import {
  buildMusicQueueReleaseTypeFilters,
  filterMusicQueueReleases,
  MUSIC_QUEUE_STATE_FILTERS,
} from '../lib/music-queue-filter-presentation.js';
import { useMusicQueue } from '../composables/useMusicQueue.js';
import { useMusicQueueReleaseFocus } from '../composables/useMusicQueueReleaseFocus.js';
import { useMusicQueueReleaseMutationFocus } from '../composables/useMusicQueueReleaseMutationFocus.js';
import { useMusicQueueReleaseDetail } from '../composables/useMusicQueueReleaseDetail.js';
import { useMusicQueueProviderRepairContext } from '../composables/useMusicQueueProviderRepairContext.js';
import { useConfirm } from '../composables/useConfirm.js';
import { hasMusicQueueProviderDependentWork } from '../lib/music-queue-provider-repair-presentation.js';
import {
  buildMusicQueueScopeFilters,
  buildMusicQueueScopePresentation,
  MUSIC_QUEUE_DEFAULT_SCOPE,
} from '../lib/music-queue-scope-presentation.js';
import { buildMusicQueueWorkspacePresentation } from '../lib/music-queue-workspace-presentation.js';
import { buildMusicQueueReleaseRecoveryPresentation } from '../lib/music-queue-release-recovery-presentation.js';
import {
  buildMusicQueueProviderRecoveryVisibility,
  isMusicQueueProviderReadyRecoveryContext,
  omitMusicQueueProviderReadyRecoveryQuery,
} from '../lib/music-queue-provider-recovery-visibility-presentation.js';
import {
  SETTINGS_RECOVERY_CONTEXT,
  createSettingsRecoveryContext,
} from '../lib/settings-recovery-handoff.js';
import { sessionStore } from '../state/session.js';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const isProviderReadyRecoveryReturn = isMusicQueueProviderReadyRecoveryContext(route.query.recovery);
const requestedReleaseId = computed(() => (
  typeof route.params.wantedReleaseId === 'string' ? route.params.wantedReleaseId : null
));
const musicQueueRecoveryContext = computed(() => createSettingsRecoveryContext({
  context: requestedReleaseId.value
    ? SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE_RELEASE
    : SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE,
  wantedReleaseId: requestedReleaseId.value,
}));

const {
  actionFeedback,
  activeMatchActionKey,
  activeMutationWantedReleaseId,
  activeReleaseActionKey,
  addToLibrary,
  allowFallbackQuality,
  errorMessage,
  isLoading,
  isRevalidating,
  load,
  rejectMatch,
  recheckLibraryAdd,
  releases,
  searchAgain,
  useMatch,
} = useMusicQueue({ immediate: !isProviderReadyRecoveryReturn });
const {
  applyRelease: applyReleaseDetail,
  detailWantedReleaseId,
  errorMessage: releaseDetailErrorMessage,
  isLoading: isReleaseDetailLoading,
  isNotFound: isReleaseDetailNotFound,
  load: loadReleaseDetail,
  release: releaseDetail,
} = useMusicQueueReleaseDetail({ wantedReleaseId: requestedReleaseId });

const isRequester = computed(() => sessionStore.state.user?.role === 'requester');
const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');
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
const selectedScope = ref(MUSIC_QUEUE_DEFAULT_SCOPE);
const selectedState = ref('all');
const selectedReleaseType = ref('all');
const selectedReleaseId = ref(requestedReleaseId.value);
const providerRecoveryVisibility = ref(null);
const scopeStatusAnnouncement = ref('');
const musicQueueHeadingElement = ref(null);
const queueListHeadingElement = ref(null);
const reviewPanelElement = ref(null);
const musicQueueReleaseFocus = useMusicQueueReleaseFocus();
const musicQueueReleaseMutationFocus = useMusicQueueReleaseMutationFocus();

const releaseTypeFilters = computed(() => buildMusicQueueReleaseTypeFilters(releases.value));
const scopeFilters = computed(() => buildMusicQueueScopeFilters(releases.value));
const filteredReleases = computed(() => filterMusicQueueReleases(releases.value, {
  query: query.value,
  releaseType: selectedReleaseType.value,
  scope: selectedScope.value,
  state: selectedState.value,
}));
const scopedReleaseCount = computed(() => filterMusicQueueReleases(releases.value, {
  scope: selectedScope.value,
}).length);
const queueScopePresentation = computed(() => buildMusicQueueScopePresentation(
  releases.value,
  selectedScope.value,
));
const queueListHeading = computed(() => queueScopePresentation.value.heading);
const hasNarrowingFilters = computed(() => (
  query.value.trim().length > 0
  || selectedState.value !== 'all'
  || selectedReleaseType.value !== 'all'
));
const queueListStatus = computed(() => {
  if (hasNarrowingFilters.value) {
    return `${filteredReleases.value.length} of ${scopedReleaseCount.value} release${scopedReleaseCount.value === 1 ? '' : 's'} ${
      'matching the current filters'
    }`;
  }

  return queueScopePresentation.value.status;
});
const queueListDetail = computed(() => (
  !hasNarrowingFilters.value && filteredReleases.value.length > 0
    ? queueScopePresentation.value.detail
    : ''
));
const hasActiveFilters = computed(() => (
  query.value.trim().length > 0
  || selectedState.value !== 'all'
  || selectedReleaseType.value !== 'all'
));
const selectedRelease = computed(() => {
  if (releaseDetail.value?.id === selectedReleaseId.value) {
    return releaseDetail.value;
  }

  return filteredReleases.value.find((release) => release.id === selectedReleaseId.value)
    ?? releases.value.find((release) => release.id === selectedReleaseId.value)
    ?? null;
});
const matchReview = computed(() => buildMusicQueueMatchReview(selectedRelease.value));
const musicQueueWorkspace = computed(() => buildMusicQueueWorkspacePresentation(selectedReleaseId.value));
const releaseDetailRecovery = computed(() => buildMusicQueueReleaseRecoveryPresentation({
  errorMessage: detailWantedReleaseId.value === requestedReleaseId.value
    ? releaseDetailErrorMessage.value
    : '',
  isNotFound: detailWantedReleaseId.value === requestedReleaseId.value
    && isReleaseDetailNotFound.value,
}));
const hasResolvedReleaseDetail = computed(() => (
  releaseDetail.value?.id === requestedReleaseId.value && Boolean(matchReview.value)
));
const musicQueueErrorMessage = computed(() => errorMessage.value);

function openReview(release, trigger) {
  musicQueueReleaseFocus.selectFromRow({ releaseId: release.id, trigger });
  selectedReleaseId.value = release.id;
  if (route.name !== 'music-queue-release' || route.params.wantedReleaseId !== release.id) {
    void router.replace({ name: 'music-queue-release', params: { wantedReleaseId: release.id } });
  }
}

function closeReview() {
  const focusCandidates = musicQueueReleaseFocus.takeCloseFocusTargets(
    queueListHeadingElement.value,
    musicQueueHeadingElement.value,
  );
  selectedReleaseId.value = null;
  void musicQueueReleaseFocus.focusFirstAvailableAfterRender(focusCandidates);
  if (route.name === 'music-queue-release') {
    void router.replace({ name: 'music-queue' });
  }
}

async function runReleaseMutation({ actionId, trigger, wasFocused, mutation } = {}) {
  const mutationId = musicQueueReleaseMutationFocus.startMutation({ trigger, wasFocused });

  try {
    await mutation?.();
  } finally {
    await musicQueueReleaseMutationFocus.focusAfterMutation({
      actionResolver: () => reviewPanelElement.value?.getActionElement(actionId),
      mutationId,
      outcomeHeadingResolver: () => reviewPanelElement.value?.getOutcomeHeadingElement(),
    });
  }
}

async function retryReleaseDetail({ actionId, trigger, wasFocused } = {}) {
  await runReleaseMutation({
    actionId,
    trigger,
    wasFocused,
    mutation: loadReleaseDetail,
  });
}

function focusDirectInspectorHeading() {
  void musicQueueReleaseFocus.focusDirectInspectorHeading({
    headingResolver: () => reviewPanelElement.value?.getHeadingElement(),
    isLoading: isReleaseDetailLoading.value,
    isReady: Boolean(hasResolvedReleaseDetail.value || releaseDetailRecovery.value),
    releaseId: requestedReleaseId.value,
  });
}

function clearFilters() {
  query.value = '';
  selectedState.value = 'all';
  selectedReleaseType.value = 'all';
  filtersExpanded.value = false;
}

function announceScopeChange() {
  scopeStatusAnnouncement.value = queueScopePresentation.value.status;
}

function showAllReleases() {
  selectedScope.value = 'all';
}

async function refreshSelectedReleaseDetail(result) {
  if (result?.release) {
    applyReleaseDetail(result.release);
    return;
  }

  await loadReleaseDetail();
}

async function handleUseMatch({ actionId, match, trigger, wasFocused } = {}) {
  await runReleaseMutation({
    actionId,
    trigger,
    wasFocused,
    mutation: async () => {
      const result = await useMatch({
        matchId: match?.matchId,
        wantedReleaseId: selectedRelease.value?.id,
      });
      if (result) {
        await refreshSelectedReleaseDetail(result);
      }
    },
  });
}

async function handleRejectMatch({ actionId, match, trigger, wasFocused } = {}) {
  await runReleaseMutation({
    actionId,
    trigger,
    wasFocused,
    mutation: async () => {
      const result = await rejectMatch({
        matchId: match?.matchId,
        wantedReleaseId: selectedRelease.value?.id,
      });
      if (result) {
        await refreshSelectedReleaseDetail(result);
      }
    },
  });
}

async function handleSearchAgain({ actionId, trigger, wasFocused } = {}) {
  await runReleaseMutation({
    actionId,
    trigger,
    wasFocused,
    mutation: async () => {
      const result = await searchAgain({
        wantedReleaseId: selectedRelease.value?.id,
      });
      if (result) {
        await refreshSelectedReleaseDetail(result);
      }
    },
  });
}

async function handleAllowFallbackQuality({ actionId, trigger, wasFocused } = {}) {
  await runReleaseMutation({
    actionId,
    trigger,
    wasFocused,
    mutation: async () => {
      const result = await allowFallbackQuality({
        wantedReleaseId: selectedRelease.value?.id,
      });
      if (result) {
        await refreshSelectedReleaseDetail(result);
      }
    },
  });
}

async function handleRecheckLibraryAdd({ actionId, trigger, wasFocused } = {}) {
  await runReleaseMutation({
    actionId,
    trigger,
    wasFocused,
    mutation: async () => {
      const result = await recheckLibraryAdd({
        wantedReleaseId: selectedRelease.value?.id,
      });
      if (result) {
        await refreshSelectedReleaseDetail(result);
      }
    },
  });
}

async function handleAddToLibrary({ actionId, trigger, wasFocused } = {}) {
  const release = selectedRelease.value;
  if (!release?.id) {
    return;
  }

  const confirmed = await confirm({
    cancelLabel: 'Keep reviewing',
    confirmLabel: 'Add to library',
    gateLabel: 'I understand Harmoniarr will add these verified files to my music library.',
    level: 'checkbox',
    message: 'Harmoniarr will check the completed files again before starting. It will not add this release if the library, quality, or audio checks no longer pass.',
    title: `Add ${release.releaseTitle} to your library?`,
    tone: 'primary',
  });
  if (!confirmed) {
    return;
  }

  await runReleaseMutation({
    actionId,
    trigger,
    wasFocused,
    mutation: async () => {
      const result = await addToLibrary({ wantedReleaseId: release.id });
      if (result) {
        await refreshSelectedReleaseDetail(result);
      }
    },
  });
}

async function refreshMusicQueue() {
  await Promise.all([load(), loadReleaseDetail()]);
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
    name: requestedReleaseId.value ? 'music-queue-release' : 'music-queue',
    params: requestedReleaseId.value ? { wantedReleaseId: requestedReleaseId.value } : undefined,
    query: omitMusicQueueProviderReadyRecoveryQuery(route.query),
  });
}

onMounted(() => {
  void consumeProviderReadyRecoveryReturn();
});

watch(
  requestedReleaseId,
  (wantedReleaseId) => {
    selectedReleaseId.value = wantedReleaseId;
    musicQueueReleaseFocus.synchronizeRouteSelection(wantedReleaseId);
  },
  { immediate: true },
);

watch(releases, (updatedReleases) => {
  const wantedReleaseId = requestedReleaseId.value;
  if (!wantedReleaseId || releaseDetail.value?.id !== wantedReleaseId) {
    return;
  }

  const refreshedRelease = updatedReleases.find((release) => release.id === wantedReleaseId);
  if (refreshedRelease) {
    applyReleaseDetail(refreshedRelease);
  }
});
</script>

<template>
  <section class="music-queue-view">
    <header class="music-queue-header">
      <div>
        <p class="hx-eyebrow">Music Queue</p>
        <h1 ref="musicQueueHeadingElement" tabindex="-1">Music Queue</h1>
        <p class="music-queue-copy">
          Review releases that need a decision. Harmoniarr continues eligible work automatically.
        </p>
      </div>
      <div class="hx-page-actions">
        <RouterLink v-if="isAdmin" class="hx-btn" data-variant="ghost" :to="{ name: 'acquisition' }">
          Acquisition overview
        </RouterLink>
        <button type="button" class="hx-btn" :disabled="isRevalidating" @click="refreshMusicQueue">
          {{ isRevalidating ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>
    </header>

    <MusicQueueProviderRepairNotice
      v-if="!isRequester"
      :notice="musicQueueProviderRepairNotice"
      :return-context="musicQueueRecoveryContext"
    />

    <MusicQueueProviderRecoveryVisibility :visibility="providerRecoveryVisibility" />

    <div v-if="musicQueueErrorMessage" class="hx-alert" data-tone="danger">
      {{ musicQueueErrorMessage }}
    </div>

    <div v-if="isLoading" class="music-queue-panel">
      Loading Music Queue...
    </div>

    <MusicQueueEmptyState v-else-if="!releases.length && !musicQueueWorkspace.hasReleaseInspector" />

    <div
      v-else
      class="music-queue-layout"
      :class="{ 'music-queue-layout--with-inspector': musicQueueWorkspace.hasReleaseInspector }"
    >
      <div class="music-queue-panel">
        <div class="music-queue-panel-header">
          <div>
            <h2 ref="queueListHeadingElement" class="music-queue-panel-title" tabindex="-1">{{ queueListHeading }}</h2>
            <p class="music-queue-panel-status">{{ queueListStatus }}</p>
            <p v-if="queueListDetail" class="music-queue-panel-detail">{{ queueListDetail }}</p>
          </div>
          <form class="music-queue-filters" aria-label="Music Queue filters" @submit.prevent>
            <label class="music-queue-filter">
              <span>Show releases</span>
              <select v-model="selectedScope" class="hx-select" @change="announceScopeChange">
                <option v-for="filter in scopeFilters" :key="filter.value" :value="filter.value">
                  {{ filter.label }} ({{ filter.count }})
                </option>
              </select>
            </label>
            <label class="music-queue-filter music-queue-filter--search">
              <span>Search this queue</span>
              <input v-model="query" class="hx-input" type="search" placeholder="Artist or release" />
            </label>
            <div class="music-queue-filter-actions">
              <button
                type="button"
                class="hx-btn"
                data-variant="ghost"
                aria-controls="music-queue-secondary-filters"
                :aria-expanded="filtersExpanded"
                @click="filtersExpanded = !filtersExpanded"
              >
                {{ filtersExpanded ? 'Hide filters' : 'More filters' }}
              </button>
              <button
                v-if="hasActiveFilters"
                type="button"
                class="hx-btn"
                data-variant="ghost"
                @click="clearFilters"
              >
                Clear filters
              </button>
            </div>
          </form>
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
          <template v-if="!hasNarrowingFilters">
            <p>{{ queueScopePresentation.emptyMessage }}</p>
            <p v-if="selectedScope === MUSIC_QUEUE_DEFAULT_SCOPE">Completed and scheduled releases remain available when you need them.</p>
            <button
              type="button"
              class="hx-btn"
              data-variant="ghost"
              @click="showAllReleases"
            >
              View all releases
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
            :inspector-id="musicQueueWorkspace.inspectorId"
            :release="release"
            :selected="selectedReleaseId === release.id"
            @open-review="openReview"
          />
        </div>
      </div>

      <p class="music-queue-status-announcement" role="status" aria-atomic="true">{{ scopeStatusAnnouncement }}</p>

      <MusicQueueReviewPanel
        v-if="musicQueueWorkspace.hasReleaseInspector"
        ref="reviewPanelElement"
        :action-feedback="actionFeedback"
        :active-match-action-key="activeMatchActionKey"
        :active-mutation-wanted-release-id="activeMutationWantedReleaseId"
        :active-release-action-key="activeReleaseActionKey"
        :inspector-id="musicQueueWorkspace.inspectorId"
        :is-loading="isReleaseDetailLoading"
        :recovery="releaseDetailRecovery"
        :review="matchReview"
        @add-to-library="handleAddToLibrary"
        @allow-fallback-quality="handleAllowFallbackQuality"
        @close="closeReview"
        @heading-ready="focusDirectInspectorHeading"
        @recheck-library-add="handleRecheckLibraryAdd"
        @reject-match="handleRejectMatch"
        @retry="retryReleaseDetail"
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

.music-queue-header h1:focus {
  outline: 2px solid var(--hx-accent);
  outline-offset: 4px;
}

.music-queue-copy,
.music-queue-panel-status,
.music-queue-panel-detail {
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
  grid-template-columns: minmax(0, 1fr);
}

.music-queue-layout--with-inspector {
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

.music-queue-panel-title:focus {
  outline: 2px solid var(--hx-accent);
  outline-offset: 4px;
}

.music-queue-panel-status,
.music-queue-panel-detail {
  font-size: var(--hx-text-sm);
  margin: var(--hx-space-1) 0 0;
}

.music-queue-panel-status {
  color: var(--hx-text);
  font-weight: 700;
}

.music-queue-filters {
  align-items: end;
  border: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  margin: 0;
  padding: 0;
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

.music-queue-status-announcement {
  block-size: 1px;
  clip-path: inset(50%);
  inline-size: 1px;
  margin: -1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
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
