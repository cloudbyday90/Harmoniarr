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
import ConfirmRequestModal from '../components/media/ConfirmRequestModal.vue';
import EmptyState from '../components/EmptyState.vue';
import ReleaseCard from '../components/media/ReleaseCard.vue';
import RequestButton from '../components/media/RequestButton.vue';
import { useLibraryWantedSummary } from '../composables/useLibraryWantedSummary.js';
import { useLibraryWantedReleases } from '../composables/useLibraryWantedReleases.js';
import { useLibraryReconciliationSummary } from '../composables/useLibraryReconciliationSummary.js';
import { useReleaseRequest } from '../composables/useReleaseRequest.js';
import { useRequestUsers } from '../composables/useRequestUsers.js';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  formatWantedTrackCounts,
  getWantedStatusLabel,
  getWantedStatusTone,
  normalizeWantedReleaseForCard,
} from '../lib/wanted-release-normalization.js';
import { sessionStore } from '../state/session.js';

const wanted = useLibraryWantedSummary();
const releases = useLibraryWantedReleases();
const reconciliation = useLibraryReconciliationSummary();

const {
  isRequested,
  isRequesting,
  requestRelease,
} = useReleaseRequest();

const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');
const { users: requestForUsers, loadUsers: loadRequestForUsers } = useRequestUsers();

// ── Filter state ──────────────────────────────────────────────────────────────

/** 'all' | 'missing' | 'partial' */
const activeFilter = ref('all');

const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'missing', label: 'Missing' },
  { value: 'partial', label: 'Partial' },
];

function applyFilter(value) {
  if (activeFilter.value === value) return;
  activeFilter.value = value;
  releases.loadWantedReleases({ wantedStatus: value === 'all' ? null : value });
}

// ── Confirm request modal ─────────────────────────────────────────────────────

const confirmModalOpen = ref(false);
const confirmRelease = ref(null);
const confirmError = ref(null);

function openConfirmModal(release) {
  confirmRelease.value = release;
  confirmError.value = null;
  confirmModalOpen.value = true;
  if (isAdmin.value) void loadRequestForUsers();
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

async function handleConfirmRequest({ requestedForUserId = null } = {}) {
  if (!confirmRelease.value) return;
  confirmError.value = null;
  const result = await requestRelease(confirmRelease.value, { requestedForUserId });
  if (result.ok) {
    confirmModalOpen.value = false;
    confirmRelease.value = null;
  } else if (!result.skipped) {
    confirmError.value = getErrorMessage(result.error, 'Request failed. Please try again.');
  }
}

// ── Normalised releases for ReleaseCard ───────────────────────────────────────

const normalizedReleases = computed(() =>
  releases.wantedReleases.value.map(normalizeWantedReleaseForCard),
);

// ── Lifecycle ─────────────────────────────────────────────────────────────────

const isLoading = computed(() => wanted.isLoading.value || releases.isLoading.value || reconciliation.isLoading.value);

function summaryTone(status) {
  if (status === 'healthy' || status === 'complete') return 'success';
  if (status === 'unavailable' || status === 'failed') return 'danger';
  return 'warning';
}

function shouldShowSummaryPill(status) {
  return Boolean(status) && status !== 'empty';
}

function refreshAll() {
  wanted.loadLibraryWantedSummary();
  releases.loadWantedReleases({ wantedStatus: activeFilter.value === 'all' ? null : activeFilter.value });
  reconciliation.loadLibraryReconciliationSummary();
}

onMounted(() => {
  wanted.loadLibraryWantedSummary();
  releases.loadWantedReleases();
  reconciliation.loadLibraryReconciliationSummary();
});
</script>

<template>
  <section class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Missing</h1>
        <p class="hx-page-subtitle">Wanted releases and reconciliation gaps across the monitored library.</p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="refreshAll" :disabled="isLoading">
          {{ isLoading ? 'Refreshing…' : 'Refresh' }}
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
      <article class="hx-stat-card">
        <span class="hx-stat-label">Monitored artists</span>
        <span class="hx-stat-value">{{ wanted.monitoredArtistCount.value }}</span>
        <span class="hx-stat-meta">Tracked for new releases</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Wanted releases</span>
        <span class="hx-stat-value">{{ wanted.releaseCounts.value?.totalWanted ?? 0 }}</span>
        <span class="hx-stat-meta">Missing + partial</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Missing</span>
        <span class="hx-stat-value">{{ wanted.releaseCounts.value?.missing ?? 0 }}</span>
        <span class="hx-stat-meta">Zero files acquired</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Partial</span>
        <span class="hx-stat-value">{{ wanted.releaseCounts.value?.partial ?? 0 }}</span>
        <span class="hx-stat-meta">Some tracks acquired</span>
      </article>
    </section>

    <article class="hx-card" v-if="wanted.summary.value">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Wanted summary</h2>
          <p class="hx-card-subtitle">Last reconciled {{ wanted.libraryWantedSummary.value?.lastReconciledAt ?? 'never' }}</p>
        </div>
        <div class="hx-card-actions">
          <span
            v-if="shouldShowSummaryPill(wanted.summary.value.status)"
            class="hx-pill"
            :data-tone="summaryTone(wanted.summary.value.status)"
          >
            {{ wanted.summary.value.status }}
          </span>
        </div>
      </header>
      <div class="hx-card-body">
        <p>{{ wanted.summary.value.message }}</p>
      </div>
    </article>

    <article class="hx-card" v-if="releases.wantedReleases.value.length > 0 || releases.isLoading.value">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Wanted releases</h2>
          <p class="hx-card-subtitle">{{ releases.totalCount.value }} release{{ releases.totalCount.value === 1 ? '' : 's' }} pending acquisition</p>
        </div>
        <div class="hx-card-actions">
          <div class="hx-filter-tabs" role="group" aria-label="Filter by status">
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

      <div class="hx-card-body" v-if="releases.isLoading.value && normalizedReleases.length === 0">
        <div class="hx-skeleton-stack">
          <span class="hx-skeleton" v-for="i in 6" :key="i"></span>
        </div>
      </div>

      <div class="hx-card-body" v-else-if="normalizedReleases.length === 0 && !releases.isLoading.value">
        <EmptyState
          title="No releases match this filter"
          :body="activeFilter === 'missing'
            ? 'No fully missing releases — all monitored releases have at least some tracks.'
            : 'No partial releases — monitored releases are either fully missing or fully acquired.'"
          variant="default"
        />
      </div>

      <div v-else class="hx-card-body hx-card-body--flush">
        <div class="hx-artwork-grid">
          <ReleaseCard
            v-for="(release, index) in normalizedReleases"
            :key="releases.wantedReleases.value[index]?.id ?? index"
            :release="release"
            :requested="isRequested(release)"
            :requesting="isRequesting(release)"
            @request="openConfirmModal(release)"
          >
            <template #actions>
              <div class="hx-wanted-card-actions">
                <div class="hx-wanted-card-meta">
                  <span
                    class="hx-pill"
                    :data-tone="getWantedStatusTone(release.wantedStatus)"
                  >
                    {{ getWantedStatusLabel(release.wantedStatus) }}
                  </span>
                  <span
                    v-if="formatWantedTrackCounts(release)"
                    class="hx-text-muted"
                  >
                    {{ formatWantedTrackCounts(release) }}
                  </span>
                </div>
                <RequestButton
                  :requested="isRequested(release)"
                  :loading="isRequesting(release)"
                  :aria-label="isRequested(release)
                    ? `${release.title ?? 'Release'} — already requested`
                    : `Request ${release.title ?? 'this release'}`"
                  @request="openConfirmModal(release)"
                />
              </div>
            </template>
          </ReleaseCard>
        </div>
      </div>
    </article>

    <article class="hx-card" v-if="reconciliation.libraryReconciliationSummary.value">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Reconciliation</h2>
          <p class="hx-card-subtitle">
            Last reconciled
            {{ reconciliation.libraryReconciliationSummary.value?.lastReconciledAt ?? 'never' }}
          </p>
        </div>
        <div class="hx-card-actions" v-if="reconciliation.summary.value && shouldShowSummaryPill(reconciliation.summary.value.status)">
          <span class="hx-pill" :data-tone="summaryTone(reconciliation.summary.value.status)">
            {{ reconciliation.summary.value.status }}
          </span>
        </div>
      </header>
      <div class="hx-card-body is-flush">
        <div class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th>Bucket</th>
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
    :is-requesting="confirmIsRequesting"
    :is-requested="confirmIsRequested"
    :error="confirmError"
    :users="isAdmin ? requestForUsers : []"
    @confirm="handleConfirmRequest"
    @close="closeConfirmModal"
  />
</template>

<style scoped>
/* ── Filter tab strip ─────────────────────────────────────────────────────── */
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
  font-size: var(--hx-text-sm);
  font-weight: 500;
  line-height: 1.4;
  border: none;
  border-radius: calc(var(--hx-radius) - 2px);
  background: transparent;
  color: var(--hx-text-muted);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}

.hx-filter-tab:hover {
  background: var(--hx-bg-surface);
  color: var(--hx-text-base);
}

.hx-filter-tab.is-active {
  background: var(--hx-bg-surface);
  color: var(--hx-text-base);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

/* ── Wanted card action area ─────────────────────────────────────────────── */
.hx-wanted-card-actions {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-2);
  width: 100%;
}

.hx-wanted-card-meta {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}
</style>
