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

const wanted = useLibraryWantedSummary();
onMounted(() => wanted.loadLibraryWantedSummary());
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">Wanted</h2>
        <p class="hx-page-subtitle">Monitored releases pending acquisition.</p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="wanted.loadLibraryWantedSummary" :disabled="wanted.isLoading.value">
          {{ wanted.isLoading.value ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <article v-if="wanted.errorMessage.value" class="hx-card">
      <div class="hx-card-body">
        <span class="hx-pill" data-tone="danger">{{ wanted.errorMessage.value }}</span>
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
        <p class="hx-page-subtitle">
          A per-release listing endpoint is not yet exposed. See the Missing workspace for additional reconciliation buckets.
        </p>
      </div>
    </article>
  </section>
</template>
