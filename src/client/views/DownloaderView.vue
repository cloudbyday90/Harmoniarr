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
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DownloaderTransferDetailDrawer from '../components/downloader/DownloaderTransferDetailDrawer.vue';
import DownloaderTransferFilters from '../components/downloader/DownloaderTransferFilters.vue';
import DownloaderTransferRowHandoffs from '../components/downloader/DownloaderTransferRowHandoffs.vue';
import {
  formatTransferFilename,
} from '../lib/activity-downloads-presentation.js';
import { formatBytes, formatSpeed } from '../lib/search-presentation.js';
import { formatOperationTimestampShort } from '../lib/operation-run-presentation.js';
import {
  clearCompletedDownloaderTransfers,
  fetchDownloaderQueue,
  requestDownloaderTransferAction,
} from '../lib/downloader-api.js';
import {
  buildDownloaderActivitySummary,
  buildDownloaderEmptyState,
  isDownloaderProviderDisabled,
} from '../lib/downloader-presentation.js';
import {
  normalizeDownloaderTransferRouteQuery,
  omitDownloaderTransferRouteQuery,
} from '../lib/downloader-transfer-route.js';
import {
  normalizeDownloaderMusicQueueHandoffRouteQuery,
  omitDownloaderMusicQueueHandoffRouteQuery,
} from '../lib/downloader-music-queue-handoff-route.js';
import {
  buildDownloaderTransferFilterResultLabel,
  filterDownloaderTransfers,
} from '../lib/downloader-transfer-filter.js';
import {
  SETTINGS_RECOVERY_CONTEXT,
  buildSettingsRecoveryHandoffLocation,
  createSettingsRecoveryContext,
} from '../lib/settings-recovery-handoff.js';
import { useAsyncResource } from '../composables/useAsyncResource.js';

const POLL_INTERVAL_MS = 5000;
const route = useRoute();
const router = useRouter();

const downloaderRecoveryContext = Object.freeze(createSettingsRecoveryContext({
  context: SETTINGS_RECOVERY_CONTEXT.DOWNLOADER,
}));

const selectedStateFilter = ref('all');
const musicQueueLinkedOnly = ref(false);
const filterResultAnnouncement = ref('');
const selectedTransferKey = ref(null);
const actionErrorMessage = ref('');
const pendingAction = ref('');

const {
  data: downloaderQueue,
  errorMessage,
  isLoading,
  lastRefreshedAt,
  load,
} = useAsyncResource({
  fetcher: () => fetchDownloaderQueue({ includeRemoved: false }),
  project: (payload) => (payload && typeof payload === 'object' ? payload : null),
  initialData: null,
  pollIntervalMs: POLL_INTERVAL_MS,
  pollWhile: (queue) => !isDownloaderProviderDisabled(queue),
  fallbackErrorMessage: 'Failed to load downloads',
});

const emptyCounts = Object.freeze({
  active: 0,
  completed: 0,
  failed: 0,
  other: 0,
  queued: 0,
  total: 0,
});

const allFiles = computed(() => (
  Array.isArray(downloaderQueue.value?.transfers)
    ? downloaderQueue.value.transfers
    : []
));
const counts = computed(() => downloaderQueue.value?.queueHealth?.counts ?? emptyCounts);
const musicQueueHandoffTarget = computed(() => (
  normalizeDownloaderMusicQueueHandoffRouteQuery(route.query)
));
const musicQueueReleaseFilterActive = computed(() => Boolean(
  musicQueueHandoffTarget.value.wantedReleaseId,
));
const visibleFiles = computed(() => filterDownloaderTransfers(allFiles.value, {
  musicQueueLinkedOnly: musicQueueLinkedOnly.value,
  stateFilter: selectedStateFilter.value,
  wantedReleaseId: musicQueueHandoffTarget.value.wantedReleaseId,
}));
const filterResultLabel = computed(() => (
  buildDownloaderTransferFilterResultLabel(visibleFiles.value.length, counts.value.total, {
    wantedReleaseId: musicQueueHandoffTarget.value.wantedReleaseId,
  })
));

const providerDisabled = computed(() => isDownloaderProviderDisabled(downloaderQueue.value));
const activitySummary = computed(() => buildDownloaderActivitySummary(downloaderQueue.value));
const emptyState = computed(() => buildDownloaderEmptyState(downloaderQueue.value));
const emptyStateActionLocation = computed(() => (
  emptyState.value.actionRouteName
    ? buildSettingsRecoveryHandoffLocation({
      recoveryContext: downloaderRecoveryContext,
      routeName: emptyState.value.actionRouteName,
    })
    : null
));

const statusCards = computed(() => [
  { key: 'active', label: 'Active', value: counts.value.active, tone: counts.value.active > 0 ? 'warning' : 'info' },
  { key: 'queued', label: 'Queued', value: counts.value.queued, tone: counts.value.queued > 0 ? 'warning' : 'info' },
  { key: 'completed', label: 'Complete', value: counts.value.completed, tone: 'success' },
  { key: 'failed', label: 'Failed', value: counts.value.failed, tone: counts.value.failed > 0 ? 'danger' : 'info' },
]);
const clearableTransferCount = computed(() => counts.value.completed + counts.value.failed);

const selectedTransfer = computed(() => (
  selectedTransferKey.value
    ? allFiles.value.find((file) => file.transferKey === selectedTransferKey.value) ?? null
    : null
));
const routeTransferTarget = computed(() => normalizeDownloaderTransferRouteQuery(route.query));
const routeTransferLookupNotice = computed(() => {
  const target = routeTransferTarget.value;
  if (target.open !== 'details' || !target.transferKey) return null;
  if (selectedTransfer.value?.transferKey === target.transferKey) return null;
  if (allFiles.value.some((file) => file.transferKey === target.transferKey)) return null;
  if (isLoading.value && !downloaderQueue.value) return null;
  if (!downloaderQueue.value) return null;

  return {
    body: 'The linked transfer is not in the current Downloader queue. It may have completed, been removed, or aged out of the live Soulseek transfer list. Import Review keeps the persisted candidate history.',
    title: 'Transfer is no longer visible in Downloader',
  };
});

function selectRouteTransferIfAvailable() {
  const transferKey = routeTransferTarget.value.transferKey;
  if (!transferKey || routeTransferTarget.value.open !== 'details') return;

  const routeTransfer = allFiles.value.find((file) => file.transferKey === transferKey);
  if (!routeTransfer) return;

  selectedTransferKey.value = routeTransfer.transferKey;
}

async function announceFilterResult() {
  filterResultAnnouncement.value = '';
  await nextTick();
  filterResultAnnouncement.value = filterResultLabel.value;
}

function updateStateFilter(stateFilter) {
  selectedStateFilter.value = stateFilter;
  void announceFilterResult();
}

function updateMusicQueueLinkedOnly(linkedOnly) {
  musicQueueLinkedOnly.value = linkedOnly;
  void announceFilterResult();
}

watch(
  () => [
    routeTransferTarget.value.open,
    routeTransferTarget.value.transferKey,
    allFiles.value.map((file) => file.transferKey).join('|'),
  ],
  selectRouteTransferIfAvailable,
  { immediate: true },
);

function progressLabel(file) {
  if (file.progress?.percentComplete !== null && file.progress?.percentComplete !== undefined) {
    return `${file.progress.percentComplete}%`;
  }
  if (file.state?.code === 'active' || file.state?.code === 'queued') return 'Waiting for progress';
  return '—';
}

function shouldShowIndeterminateProgress(file) {
  return file?.state?.code === 'active' || file?.state?.code === 'queued';
}

function openTransferDetail(file) {
  if (!file?.transferKey) return;
  selectedTransferKey.value = file.transferKey;
}

function closeTransferDetail() {
  const closedTransferKey = selectedTransferKey.value;
  selectedTransferKey.value = null;
  actionErrorMessage.value = '';
  pendingAction.value = '';

  if (closedTransferKey && routeTransferTarget.value.transferKey === closedTransferKey) {
    clearRouteTransferHandoff();
  }
}

function clearRouteTransferHandoff() {
  void router.replace({
    name: 'downloader',
    query: omitDownloaderTransferRouteQuery(route.query),
  });
}

function clearMusicQueueReleaseHandoff() {
  void router.replace({
    name: 'downloader',
    query: omitDownloaderMusicQueueHandoffRouteQuery(route.query),
  });
}

async function performTransferAction(action) {
  if (!selectedTransfer.value || pendingAction.value || providerDisabled.value) return;
  actionErrorMessage.value = '';
  pendingAction.value = action;
  try {
    await requestDownloaderTransferAction({
      action,
      id: selectedTransfer.value.id,
      username: selectedTransfer.value.sourceUser,
    });
    await load();
    closeTransferDetail();
  } catch (error) {
    actionErrorMessage.value = error?.message ?? 'Downloader action failed';
  } finally {
    pendingAction.value = '';
  }
}

async function clearCompletedTransfers() {
  if (pendingAction.value || providerDisabled.value) return;
  actionErrorMessage.value = '';
  pendingAction.value = 'clear_completed';
  try {
    await clearCompletedDownloaderTransfers();
    await load();
  } catch (error) {
    actionErrorMessage.value = error?.message ?? 'Failed to clear completed transfers';
  } finally {
    pendingAction.value = '';
  }
}
</script>

<template>
  <section class="hx-page downloader-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Downloader</h1>
        <p class="hx-page-subtitle">
          Live transfer queue, active downloads, and recent outcomes from your download client.
          {{ activitySummary }}
          <span v-if="downloaderQueue?.observedAt">Observed {{ formatOperationTimestampShort(downloaderQueue.observedAt) }}.</span>
          <span v-if="lastRefreshedAt">Refreshed {{ formatOperationTimestampShort(lastRefreshedAt) }}.</span>
        </p>
      </div>
      <div class="hx-page-actions">
        <RouterLink class="hx-btn" data-variant="ghost" :to="{ name: 'acquisition' }">
          Acquisition overview
        </RouterLink>
        <button
          type="button"
          class="hx-btn"
          data-variant="ghost"
          :disabled="providerDisabled || pendingAction === 'clear_completed' || clearableTransferCount < 1"
          @click="clearCompletedTransfers"
        >
          {{ pendingAction === 'clear_completed' ? 'Clearing...' : 'Clear Completed' }}
        </button>
        <button type="button" class="hx-btn" @click="load" :disabled="isLoading || providerDisabled">
          {{ isLoading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <section class="hx-stat-grid" aria-label="Downloader transfer summary">
      <article v-for="card in statusCards" :key="card.key" class="hx-stat">
        <span class="hx-stat-label">{{ card.label }}</span>
        <span class="hx-stat-value">{{ card.value }}</span>
        <span class="hx-pill downloader-stat-pill" :data-tone="card.tone">{{ card.label }}</span>
      </article>
    </section>

    <article v-if="errorMessage" class="hx-card" role="status" aria-live="polite">
      <div class="hx-card-body">
        <span class="hx-pill" data-tone="danger">{{ errorMessage }}</span>
      </div>
    </article>

    <article v-if="actionErrorMessage && !selectedTransfer" class="hx-card" role="status" aria-live="polite">
      <div class="hx-card-body">
        <span class="hx-pill" data-tone="danger">{{ actionErrorMessage }}</span>
      </div>
    </article>

    <article v-if="routeTransferLookupNotice" class="hx-card downloader-route-notice" role="status" aria-live="polite">
      <div class="hx-card-body downloader-route-notice-body">
        <div>
          <h2 class="downloader-route-notice-title">{{ routeTransferLookupNotice.title }}</h2>
          <p class="downloader-route-notice-copy">{{ routeTransferLookupNotice.body }}</p>
        </div>
        <button type="button" class="hx-btn" data-variant="ghost" @click="clearRouteTransferHandoff">
          Clear link
        </button>
      </div>
    </article>

    <article v-if="musicQueueReleaseFilterActive" class="hx-card downloader-music-queue-handoff">
      <div class="hx-card-body downloader-music-queue-handoff__body">
        <div>
          <h2 class="downloader-music-queue-handoff__title">Music Queue transfer</h2>
          <p class="downloader-music-queue-handoff__copy">
            Showing live transfers linked to this release. Download controls are here; release decisions remain in Music Queue.
          </p>
        </div>
        <div class="downloader-music-queue-handoff__actions">
          <RouterLink
            class="hx-btn"
            data-variant="ghost"
            :to="{
              name: 'music-queue-release',
              params: { wantedReleaseId: musicQueueHandoffTarget.wantedReleaseId },
            }"
          >
            Open release in Music Queue
          </RouterLink>
          <button type="button" class="hx-btn" data-variant="ghost" @click="clearMusicQueueReleaseHandoff">
            Show all transfers
          </button>
        </div>
      </div>
    </article>

    <article class="hx-card downloader-transfer-queue">
      <div class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Transfer Queue</h2>
          <p class="hx-card-subtitle">
            {{ filterResultLabel }}
          </p>
        </div>
        <div class="hx-card-actions">
          <DownloaderTransferFilters
            :music-queue-linked-only="musicQueueLinkedOnly"
            :music-queue-release-filter-active="musicQueueReleaseFilterActive"
            :state-filter="selectedStateFilter"
            @update:music-queue-linked-only="updateMusicQueueLinkedOnly"
            @update:state-filter="updateStateFilter"
          />
        </div>
      </div>
      <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ filterResultAnnouncement }}</p>

      <div class="hx-card-body is-flush">
        <div v-if="isLoading && !allFiles.length" class="hx-card-body">
          <div class="hx-skeleton-stack">
            <span class="hx-skeleton" data-size="lg"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
          </div>
        </div>
        <div v-else-if="!allFiles.length" class="hx-empty">
          <template v-if="musicQueueReleaseFilterActive">
            <p class="hx-empty-title">No live transfer for this Music Queue release</p>
            <p class="hx-empty-copy">The transfer may not have started, may have completed, or may no longer be in the live queue.</p>
            <div class="hx-empty-actions">
              <RouterLink
                class="hx-btn"
                :to="{
                  name: 'music-queue-release',
                  params: { wantedReleaseId: musicQueueHandoffTarget.wantedReleaseId },
                }"
              >
                Open release in Music Queue
              </RouterLink>
            </div>
          </template>
          <template v-else>
            <p class="hx-empty-title">{{ emptyState.title }}</p>
            <p class="hx-empty-copy">{{ emptyState.body }}</p>
            <div v-if="emptyState.actionRouteName && emptyState.actionLabel" class="hx-empty-actions">
              <RouterLink class="hx-btn" :to="emptyStateActionLocation">
                {{ emptyState.actionLabel }}
              </RouterLink>
            </div>
          </template>
        </div>
        <div v-else-if="!visibleFiles.length" class="hx-empty">
          <template v-if="musicQueueReleaseFilterActive">
            <p class="hx-empty-title">No live transfer for this Music Queue release</p>
            <p class="hx-empty-copy">The visible queue does not contain a transfer for this release.</p>
            <div class="hx-empty-actions">
              <button type="button" class="hx-btn" @click="clearMusicQueueReleaseHandoff">Show all transfers</button>
            </div>
          </template>
          <template v-else>
            <p class="hx-empty-title">No transfers match these filters</p>
            <p class="hx-empty-copy">Change the transfer filters to review other items.</p>
          </template>
        </div>
        <div v-else class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Source User</th>
                <th>State</th>
                <th class="hx-table-num">Progress</th>
                <th class="hx-table-num">Size</th>
                <th class="hx-table-num">Speed</th>
                <th class="hx-table-num">Queue</th>
                <th class="hx-table-num">Diagnostics</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in visibleFiles" :key="file.transferKey">
                <td>
                  <span class="downloader-file" :title="file.filename">{{ formatTransferFilename(file.filename) }}</span>
                  <span v-if="file.directory" class="downloader-file-directory">{{ file.directory }}</span>
                </td>
                <td>{{ file.sourceUser ?? '—' }}</td>
                <td>
                  <span class="hx-pill" :data-tone="file.state?.tone ?? 'info'">
                    {{ file.state?.label ?? 'Unknown' }}
                  </span>
                </td>
                <td class="hx-table-num">
                  <div class="downloader-progress-cell">
                    <progress
                      v-if="file.progress?.percentComplete !== null && file.progress?.percentComplete !== undefined"
                      class="downloader-progress"
                      :value="file.progress.percentComplete"
                      max="100"
                    >{{ file.progress.percentComplete }}%</progress>
                    <progress
                      v-else-if="shouldShowIndeterminateProgress(file)"
                      class="downloader-progress"
                      max="100"
                    >Waiting for progress</progress>
                    <span>{{ progressLabel(file) }}</span>
                  </div>
                </td>
                <td class="hx-table-num">{{ formatBytes(file.progress?.size) }}</td>
                <td class="hx-table-num">{{ formatSpeed(file.averageSpeed) }}</td>
                <td class="hx-table-num">
                  <span v-if="file.placeInQueue !== null && file.placeInQueue !== undefined">{{ file.placeInQueue }}</span>
                  <span v-else>—</span>
                </td>
                <td class="hx-table-num">
                  <div class="downloader-diagnostics-actions">
                    <button
                      type="button"
                      class="hx-btn downloader-detail-button"
                      @click="openTransferDetail(file)"
                    >
                      Details
                    </button>
                    <DownloaderTransferRowHandoffs :transfer="file" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>

    <DownloaderTransferDetailDrawer
      :action-error="actionErrorMessage"
      :action-pending="pendingAction"
      :open="Boolean(selectedTransfer)"
      :observed-at="downloaderQueue?.observedAt ?? null"
      :transfer="selectedTransfer"
      @close="closeTransferDetail"
      @request-action="performTransferAction"
    />
  </section>
</template>

<style scoped>
.downloader-page {
  max-width: 1600px;
}

.downloader-stat-pill {
  justify-self: start;
}

.downloader-file {
  display: block;
  max-width: 440px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.downloader-file-directory {
  display: block;
  max-width: 440px;
  margin-top: 2px;
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.downloader-progress-cell {
  display: inline-grid;
  min-width: 150px;
  gap: 4px;
  justify-items: end;
}

.downloader-progress {
  width: 150px;
  height: 8px;
  accent-color: var(--hx-accent);
}

.downloader-page .hx-empty-actions {
  display: flex;
  justify-content: center;
  margin-top: var(--hx-space-4);
}

.downloader-route-notice {
  border-color: color-mix(in srgb, var(--hx-warning) 36%, var(--hx-border));
}

.downloader-route-notice-body {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--hx-space-4);
}

.downloader-route-notice-title {
  margin: 0;
  color: var(--hx-text-strong);
  font-size: var(--hx-text-base);
}

.downloader-route-notice-copy {
  max-width: 760px;
  margin: var(--hx-space-1) 0 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.5;
}

.downloader-music-queue-handoff__body {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--hx-space-4);
}

.downloader-music-queue-handoff__title {
  margin: 0;
  color: var(--hx-text-strong);
  font-size: var(--hx-text-base);
}

.downloader-music-queue-handoff__copy {
  max-width: 760px;
  margin: var(--hx-space-1) 0 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.5;
}

.downloader-music-queue-handoff__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--hx-space-2);
}

.downloader-detail-button {
  min-height: 32px;
  padding: 0 var(--hx-space-3);
}

.downloader-diagnostics-actions {
  display: inline-grid;
  gap: var(--hx-space-1);
  justify-items: end;
}

@media (max-width: 640px) {
  .downloader-transfer-queue .hx-card-header {
    flex-direction: column;
  }

  .downloader-transfer-queue .hx-card-actions {
    align-self: stretch;
  }

  .downloader-music-queue-handoff__body {
    flex-direction: column;
  }

  .downloader-music-queue-handoff__actions {
    width: 100%;
  }

  .downloader-music-queue-handoff__actions > * {
    flex: 1 1 100%;
  }
}

</style>
