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
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import ConfirmRequestModal from '../components/media/ConfirmRequestModal.vue';
import EmptyState from '../components/EmptyState.vue';
import GridControls from '../components/GridControls.vue';
import MissingReleaseDecisionActions from '../components/media/MissingReleaseDecisionActions.vue';
import ReleaseCard from '../components/media/ReleaseCard.vue';
import { useArtworkGridRoving } from '../composables/useArtworkGridRoving.js';
import { useGridState } from '../composables/useGridState.js';
import { useDownloadRecoveryRetry } from '../composables/useDownloadRecoveryRetry.js';
import { useLibraryWantedSummary } from '../composables/useLibraryWantedSummary.js';
import { useLibraryWantedReleases } from '../composables/useLibraryWantedReleases.js';
import { useLibraryReconciliationSummary } from '../composables/useLibraryReconciliationSummary.js';
import { getManualSelectionLabel, useManualReleaseInclusion } from '../composables/useManualReleaseInclusion.js';
import { useReleaseRequest } from '../composables/useReleaseRequest.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { buildMissingReleaseMusicQueueRoute } from '../lib/missing-release-decision-presentation.js';
import {
  buildDownloadRecoveryNotice,
  buildMissingPageSubtitle,
  buildMissingStatCards,
  buildWantedReleasesCardSubtitle,
  formatLastReconciledAt,
  formatMissingSummaryStatus,
  getMissingSummaryTone,
  normalizeWantedReleaseForCard,
  shouldShowMissingSummaryPill,
  sortWantedReleases,
} from '../lib/wanted-release-normalization.js';

const wanted = useLibraryWantedSummary({ pollIntervalMs: 30000, revalidateOnFocus: true });
const releases = useLibraryWantedReleases({ pollIntervalMs: 30000, revalidateOnFocus: true });
const reconciliation = useLibraryReconciliationSummary({ pollIntervalMs: 30000, revalidateOnFocus: true });

const {
  isRequested,
  isRequesting,
  requestRelease,
} = useReleaseRequest();
const recoveryRetry = useDownloadRecoveryRetry();
const manualInclusion = useManualReleaseInclusion();
const router = useRouter();

// ── Sort / filter definitions ─────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'artist', label: 'Artist' },
  { value: 'title', label: 'Title' },
  { value: 'date', label: 'Release date' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'missing', label: 'Not in library' },
  { value: 'partial', label: 'Some tracks missing' },
];

const MISSING_DEFAULTS = {
  sort: { field: 'artist', order: 'asc' },
  filters: {},
};

// ── Grid state (URL-synced) ───────────────────────────────────────────────────

const {
  clearAll,
  filterState,
  isDefault,
  updateState,
} = useGridState(MISSING_DEFAULTS, {
  filterGroupKeys: ['status'],
  sortOptions: SORT_OPTIONS,
  filterGroups: [{ key: 'status', label: 'Status', options: STATUS_FILTER_OPTIONS }],
});

// ── Client-side filtered + sorted releases ────────────────────────────────────

const filteredReleases = computed(() => {
  const all = releases.wantedReleases.value;
  const statusFilter = filterState.value?.filters?.status;
  const filtered = statusFilter
    ? all.filter((r) => r.wantedStatus === statusFilter)
    : all;
  const field = filterState.value?.sort?.field ?? 'artist';
  const order = filterState.value?.sort?.order ?? 'asc';
  return sortWantedReleases(filtered, field, order);
});

const normalizedReleases = computed(() =>
  filteredReleases.value.map((release) => ({
    ...normalizeWantedReleaseForCard(release),
    downloadRecoveryNotice: buildDownloadRecoveryNotice(release),
  })),
);

// Roving tabindex over the missing-releases grid (one tab stop; arrows move focus).
const missingGridEl = useTemplateRef('missingGrid');
useArtworkGridRoving(() => missingGridEl.value, {
  cellSelector: '.hx-media-card__link-area',
  count: () => normalizedReleases.value.length,
});

const confirmModalOpen = ref(false);
const confirmRelease = ref(null);
const confirmError = ref(null);

function openConfirmModal(release) {
  confirmRelease.value = release;
  confirmError.value = null;
  confirmModalOpen.value = true;
}

function closeConfirmModal() {
  if (!isRequesting(confirmRelease.value)) {
    confirmModalOpen.value = false;
    confirmRelease.value = null;
    confirmError.value = null;
  }
}

const confirmIsRequesting = computed(() =>
  confirmRelease.value ? isRequesting(confirmRelease.value) : false,
);

const confirmIsRequested = computed(() =>
  confirmRelease.value ? isRequested(confirmRelease.value) : false,
);

async function handleConfirmRequest() {
  if (!confirmRelease.value) return;
  const release = confirmRelease.value;
  confirmError.value = null;
  const result = await requestRelease(release);
  if (result.ok) {
    confirmModalOpen.value = false;
    confirmRelease.value = null;
    const location = buildMissingReleaseMusicQueueRoute(release);
    if (location) {
      await router.push(location);
    }
  } else if (!result.skipped) {
    confirmError.value = getErrorMessage(result.error, 'Request failed. Please try again.');
  }
}

// ── Normalised releases for ReleaseCard ───────────────────────────────────────

// normalizedReleases is now defined above in the filter section

// ── Lifecycle ─────────────────────────────────────────────────────────────────

const isLoading = computed(() => wanted.isLoading.value || releases.isLoading.value || reconciliation.isLoading.value);
const isRefreshing = computed(() =>
  wanted.isRevalidating.value
  || releases.isRevalidating.value
  || reconciliation.isRevalidating.value,
);

const statCards = computed(() =>
  buildMissingStatCards(
    wanted.monitoredArtistCount.value,
    wanted.releaseCounts.value?.totalWanted ?? 0,
    wanted.releaseCounts.value?.missing ?? 0,
    wanted.releaseCounts.value?.partial ?? 0,
  ),
);

function refreshAll() {
  wanted.loadLibraryWantedSummary();
  releases.loadWantedReleases();
  reconciliation.loadLibraryReconciliationSummary();
}

const manualInclusionModalOpen = ref(false);
const manualInclusionRelease = ref(null);
const manualInclusionError = ref(null);

function openManualInclusionModal(release) {
  manualInclusionRelease.value = release;
  manualInclusionError.value = null;
  manualInclusionModalOpen.value = true;
}

function closeManualInclusionModal() {
  if (!manualInclusion.isIncluding(manualInclusionRelease.value)) {
    manualInclusionModalOpen.value = false;
    manualInclusionRelease.value = null;
    manualInclusionError.value = null;
  }
}

const manualInclusionIsSaving = computed(() => (
  manualInclusion.isIncluding(manualInclusionRelease.value)
));

const manualInclusionIsSaved = computed(() => (
  manualInclusion.isManualSelection(manualInclusionRelease.value)
));

async function handleConfirmManualInclusion() {
  if (!manualInclusionRelease.value) return;
  manualInclusionError.value = null;
  const result = await manualInclusion.includeManually(manualInclusionRelease.value);
  if (result.ok) {
    closeManualInclusionModal();
    refreshAll();
  } else if (!result.skipped) {
    manualInclusionError.value = getErrorMessage(
      result.error,
      'Could not save the manual inclusion. Please try again.',
    );
  }
}

async function retryDownloadRecovery(release) {
  const result = await recoveryRetry.retryDownloadRecovery(release);
  if (result.ok) {
    refreshAll();
  }
}

function openMusicQueue(release) {
  const location = buildMissingReleaseMusicQueueRoute(release);
  if (location) {
    void router.push(location);
  }
}

onMounted(() => {
  void wanted.loadLibraryWantedSummary();
  void releases.loadWantedReleases();
  void reconciliation.loadLibraryReconciliationSummary();
  wanted.attachVisibilityListener();
  releases.attachVisibilityListener();
  reconciliation.attachVisibilityListener();
});

onBeforeUnmount(() => {
  wanted.destroy();
  releases.destroy();
  reconciliation.destroy();
});
</script>

<template>
  <section class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Missing music</h1>
        <p class="hx-page-subtitle">{{ buildMissingPageSubtitle() }}</p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="refreshAll" :disabled="isLoading || isRefreshing">
          {{ (isLoading || isRefreshing) ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <article v-if="wanted.errorMessage.value || reconciliation.errorMessage.value" class="hx-card">
      <div class="hx-card-body">
        <span class="hx-pill" data-tone="danger">
          {{ wanted.errorMessage.value || reconciliation.errorMessage.value }}
        </span>
      </div>
    </article>

    <section class="hx-stat-grid" v-if="isLoading && !wanted.libraryWantedSummary.value">
      <article class="hx-stat-card" v-for="i in 4" :key="i">
        <span class="hx-skeleton" data-size="sm" style="width: 60%"></span>
        <span class="hx-skeleton" data-size="lg" style="width: 40%"></span>
        <span class="hx-skeleton" data-size="sm" style="width: 75%"></span>
      </article>
    </section>

    <section class="hx-stat-grid" v-if="wanted.libraryWantedSummary.value">
      <article class="hx-stat-card" v-for="card in statCards" :key="card.label">
        <span class="hx-stat-label">{{ card.label }}</span>
        <span class="hx-stat-value">{{ card.value }}</span>
        <span class="hx-stat-meta">{{ card.meta }}</span>
      </article>
    </section>

    <article class="hx-card" v-if="wanted.summary.value">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Acquisition status</h2>
          <p class="hx-card-subtitle">{{ formatLastReconciledAt(wanted.libraryWantedSummary.value?.lastReconciledAt) }}</p>
        </div>
        <div class="hx-card-actions">
          <span
            v-if="shouldShowMissingSummaryPill(wanted.summary.value.status)"
            class="hx-pill"
            :data-tone="getMissingSummaryTone(wanted.summary.value.status)"
          >
            {{ formatMissingSummaryStatus(wanted.summary.value.status) }}
          </span>
        </div>
      </header>
      <div class="hx-card-body">
        <p>{{ wanted.summary.value.message }}</p>
      </div>
    </article>

    <article class="hx-card" v-if="releases.wantedReleases.value.length > 0 || releases.isLoading.value || !isDefault">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Selected releases</h2>
          <p v-if="buildWantedReleasesCardSubtitle(releases.totalCount.value)" class="hx-card-subtitle">{{ buildWantedReleasesCardSubtitle(releases.totalCount.value) }}</p>
        </div>
      </header>

      <!-- GridControls -->
      <div class="hx-card-body">
        <GridControls
          :model-value="filterState"
          :sort-options="SORT_OPTIONS"
          :filter-groups="[{ key: 'status', label: 'Status', options: STATUS_FILTER_OPTIONS }]"
          :is-default="isDefault"
          :is-loading="false"
          @clear-all="clearAll"
          @update:model-value="updateState"
        />
      </div>

      <div class="hx-card-body" v-if="releases.isLoading.value && normalizedReleases.length === 0">
        <div class="hx-skeleton-stack">
          <span class="hx-skeleton" v-for="i in 6" :key="i"></span>
        </div>
      </div>

      <div class="hx-card-body" v-else-if="normalizedReleases.length === 0 && !releases.isLoading.value">
        <EmptyState
          v-if="isDefault"
          title="No selected releases are missing"
          body="Selected releases appear here when they are not yet fully in your library."
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

      <div v-else class="hx-card-body hx-card-body--flush">
        <ul ref="missingGrid" class="hx-artwork-grid" role="list" aria-label="Selected releases not in library">
          <li v-for="(release, index) in normalizedReleases" :key="filteredReleases[index]?.id ?? index">
          <ReleaseCard
            :release="release"
            detail-action-label="Open Music Queue"
            @detail="openMusicQueue(release)"
          >
            <template #actions>
              <MissingReleaseDecisionActions
                :can-keep-selected-manually="manualInclusion.canIncludeManually(release)"
                :download-recovery-notice="release.downloadRecoveryNotice"
                :is-keeping-selected-manually="manualInclusion.isIncluding(release)"
                :is-manual-selection="manualInclusion.isManualSelection(release)"
                :is-retrying-search="recoveryRetry.isRetrying(release)"
                :is-starting-search="isRequesting(release)"
                :manual-selection-label="getManualSelectionLabel(release)"
                :release="release"
                :search-started="isRequested(release)"
                @keep-selected-manually="openManualInclusionModal(release)"
                @open-music-queue="openMusicQueue(release)"
                @retry-search="retryDownloadRecovery(release)"
                @start-search="openConfirmModal(release)"
              />
            </template>
          </ReleaseCard>
          </li>
        </ul>
      </div>
    </article>

    <article class="hx-card" v-if="reconciliation.libraryReconciliationSummary.value">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Reconciliation</h2>
          <p class="hx-card-subtitle">
            {{ formatLastReconciledAt(reconciliation.libraryReconciliationSummary.value?.lastReconciledAt) }}
          </p>
        </div>
        <div class="hx-card-actions" v-if="reconciliation.summary.value && shouldShowMissingSummaryPill(reconciliation.summary.value.status)">
          <span class="hx-pill" :data-tone="getMissingSummaryTone(reconciliation.summary.value.status)">
            {{ formatMissingSummaryStatus(reconciliation.summary.value.status) }}
          </span>
        </div>
      </header>
      <div class="hx-card-body is-flush">
        <div class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th>Category</th>
                <th class="hx-table-num">Count</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Files observed</td>
                <td class="hx-table-num">{{ reconciliation.fileCounts.value?.observed ?? 0 }}</td>
                <td>Total files seen on disk</td>
              </tr>
              <tr>
                <td>Files matched</td>
                <td class="hx-table-num">{{ reconciliation.fileCounts.value?.matched ?? 0 }}</td>
                <td>Linked to a known release</td>
              </tr>
              <tr>
                <td>Files ambiguous</td>
                <td class="hx-table-num">{{ reconciliation.fileCounts.value?.ambiguous ?? 0 }}</td>
                <td>Multiple candidate matches</td>
              </tr>
              <tr>
                <td>Files unmatched</td>
                <td class="hx-table-num">{{ reconciliation.fileCounts.value?.unmatched ?? 0 }}</td>
                <td>No match found</td>
              </tr>
              <tr>
                <td>Releases complete</td>
                <td class="hx-table-num">{{ reconciliation.releaseCounts.value?.complete ?? 0 }}</td>
                <td>All tracks present</td>
              </tr>
              <tr>
                <td>Releases partial</td>
                <td class="hx-table-num">{{ reconciliation.releaseCounts.value?.partial ?? 0 }}</td>
                <td>Some tracks missing</td>
              </tr>
              <tr>
                <td>Releases duplicate</td>
                <td class="hx-table-num">{{ reconciliation.releaseCounts.value?.duplicate ?? 0 }}</td>
                <td>More than one acquired copy</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>

    <article class="hx-card" v-if="!wanted.libraryWantedSummary.value && !isLoading">
      <div class="hx-card-body">
        <div class="hx-empty">
          <p class="hx-empty-title">No wanted data yet</p>
          <p class="hx-empty-copy">Trigger a library scan and reconciliation from Settings → Library to populate this workspace.</p>
        </div>
      </div>
    </article>
  </section>

  <ConfirmRequestModal
    :open="confirmModalOpen"
    :release="confirmRelease"
    :loading="confirmIsRequesting"
    :requested="confirmIsRequested"
    :error-message="confirmError"
    action-context="music_queue_search"
    dialog-id="missing-music-search-confirmation"
    @confirm="handleConfirmRequest"
    @close="closeConfirmModal"
  />

  <ConfirmRequestModal
    :open="manualInclusionModalOpen"
    :release="manualInclusionRelease"
    :loading="manualInclusionIsSaving"
    :requested="manualInclusionIsSaved"
    :error-message="manualInclusionError"
    action-context="manual_inclusion"
    dialog-id="missing-music-manual-inclusion-confirmation"
    @confirm="handleConfirmManualInclusion"
    @close="closeManualInclusionModal"
  />
</template>
