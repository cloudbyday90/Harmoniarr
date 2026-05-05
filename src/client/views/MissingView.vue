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
import { computed, onMounted } from 'vue';
import { useLibraryWantedSummary } from '../composables/useLibraryWantedSummary.js';
import { useLibraryWantedReleases } from '../composables/useLibraryWantedReleases.js';
import { useLibraryReconciliationSummary } from '../composables/useLibraryReconciliationSummary.js';

const wanted = useLibraryWantedSummary();
const releases = useLibraryWantedReleases();
const reconciliation = useLibraryReconciliationSummary();

onMounted(() => {
  wanted.loadLibraryWantedSummary();
  releases.loadWantedReleases();
  reconciliation.loadLibraryReconciliationSummary();
});

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
  releases.loadWantedReleases();
  reconciliation.loadLibraryReconciliationSummary();
}
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

    <article class="hx-card" v-if="releases.wantedReleases.value.length > 0">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Wanted releases</h2>
          <p class="hx-card-subtitle">{{ releases.totalCount.value }} release{{ releases.totalCount.value === 1 ? '' : 's' }} pending acquisition</p>
        </div>
      </header>
      <div class="hx-card-body hx-card-body--flush">
        <table class="hx-table">
          <thead>
            <tr>
              <th>Artist</th>
              <th>Release group</th>
              <th>Release</th>
              <th>Type</th>
              <th>Status</th>
              <th class="hx-table-num">Expected</th>
              <th class="hx-table-num">Matched</th>
              <th class="hx-table-num">Missing</th>
              <th>Release date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="release in releases.wantedReleases.value" :key="release.id">
              <td>{{ release.artistName }}</td>
              <td>{{ release.releaseGroupTitle }}</td>
              <td>
                {{ release.releaseTitle }}
                <span v-if="release.releaseDisambiguation" class="hx-muted"> ({{ release.releaseDisambiguation }})</span>
              </td>
              <td>{{ release.releaseGroupType ?? '—' }}</td>
              <td>
                <span class="hx-pill" :data-tone="release.wantedStatus === 'missing' ? 'danger' : 'warning'">
                  {{ release.wantedStatus }}
                </span>
              </td>
              <td class="hx-table-num">{{ release.expectedTrackCount }}</td>
              <td class="hx-table-num">{{ release.matchedTrackCount }}</td>
              <td class="hx-table-num">{{ release.missingTrackCount }}</td>
              <td>{{ release.releaseDate ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
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
</template>
