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
import { onMounted } from 'vue';
import { useLibraryWantedSummary } from '../composables/useLibraryWantedSummary.js';
import { useLibraryWantedReleases } from '../composables/useLibraryWantedReleases.js';

const wanted = useLibraryWantedSummary();
const releases = useLibraryWantedReleases();

function refresh() {
  wanted.loadLibraryWantedSummary();
  releases.loadWantedReleases();
}

onMounted(() => refresh());
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">Wanted</h2>
        <p class="hx-page-subtitle">Monitored releases pending acquisition.</p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="refresh" :disabled="wanted.isLoading.value || releases.isLoading.value">
          {{ (wanted.isLoading.value || releases.isLoading.value) ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <article v-if="wanted.errorMessage.value || releases.errorMessage.value" class="hx-card">
      <div class="hx-card-body">
        <span v-if="wanted.errorMessage.value" class="hx-pill" data-tone="danger">{{ wanted.errorMessage.value }}</span>
        <span v-if="releases.errorMessage.value" class="hx-pill" data-tone="danger">{{ releases.errorMessage.value }}</span>
      </div>
    </article>

    <section class="hx-stat-grid" v-if="wanted.libraryWantedSummary.value">
      <article class="hx-stat-card">
        <span class="hx-stat-label">Monitored artists</span>
        <span class="hx-stat-value">{{ wanted.monitoredArtistCount.value }}</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Wanted releases</span>
        <span class="hx-stat-value">{{ wanted.releaseCounts.value?.totalWanted ?? 0 }}</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Missing</span>
        <span class="hx-stat-value">{{ wanted.releaseCounts.value?.missing ?? 0 }}</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Partial</span>
        <span class="hx-stat-value">{{ wanted.releaseCounts.value?.partial ?? 0 }}</span>
      </article>
    </section>

    <article class="hx-card" v-if="wanted.summary.value">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Reconciliation</h3>
          <p class="hx-card-subtitle">Last reconciled {{ wanted.libraryWantedSummary.value?.lastReconciledAt ?? 'never' }}</p>
        </div>
      </header>
      <div class="hx-card-body">
        <p>{{ wanted.summary.value.message }}</p>
      </div>
    </article>

    <article class="hx-card" v-if="releases.wantedReleases.value.length > 0">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Wanted releases</h3>
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

    <article class="hx-card" v-if="!wanted.libraryWantedSummary.value && !wanted.isLoading.value && !releases.isLoading.value">
      <div class="hx-card-body">
        <div class="hx-empty">
          <p class="hx-empty-title">No wanted data yet</p>
          <p class="hx-empty-copy">Trigger a library scan and reconciliation from Settings → Library to populate this view.</p>
        </div>
      </div>
    </article>
  </section>
</template>
