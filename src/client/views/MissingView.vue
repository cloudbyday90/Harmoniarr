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
import { useRoute } from 'vue-router';
import MissingMusicDecisionInspector from '../components/missing-music/MissingMusicDecisionInspector.vue';
import MissingMusicDecisionWorklist from '../components/missing-music/MissingMusicDecisionWorklist.vue';
import { useLibraryWantedSummary } from '../composables/useLibraryWantedSummary.js';
import { useLibraryReconciliationSummary } from '../composables/useLibraryReconciliationSummary.js';
import {
  buildMissingPageSubtitle,
  buildMissingStatCards,
  formatLastReconciledAt,
  formatMissingSummaryStatus,
  getMissingSummaryTone,
  shouldShowMissingSummaryPill,
} from '../lib/wanted-release-normalization.js';

const wanted = useLibraryWantedSummary({ pollIntervalMs: 30000, revalidateOnFocus: true });
const reconciliation = useLibraryReconciliationSummary({ pollIntervalMs: 30000, revalidateOnFocus: true });
const route = useRoute();
const selectedDecisionId = computed(() => (
  typeof route.params.decisionId === 'string' && route.params.decisionId.trim().length > 0
    ? route.params.decisionId.trim()
    : null
));
const pageHeadingElement = ref(null);

async function focusPageHeadingAfterInspectorClose() {
  await nextTick();
  pageHeadingElement.value?.focus({ preventScroll: true });
}

watch(selectedDecisionId, (decisionId, previousDecisionId) => {
  if (!previousDecisionId || decisionId) return;

  void focusPageHeadingAfterInspectorClose();
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────

const isLoading = computed(() => wanted.isLoading.value || reconciliation.isLoading.value);
const isRefreshing = computed(() =>
  wanted.isRevalidating.value
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
  reconciliation.loadLibraryReconciliationSummary();
}

onMounted(() => {
  void wanted.loadLibraryWantedSummary();
  void reconciliation.loadLibraryReconciliationSummary();
  wanted.attachVisibilityListener();
  reconciliation.attachVisibilityListener();
});

onBeforeUnmount(() => {
  wanted.destroy();
  reconciliation.destroy();
});
</script>

<template>
  <section class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 ref="pageHeadingElement" class="hx-page-title missing-music-page-title" tabindex="-1">Missing Music</h1>
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
          <h2 class="hx-card-title">Library coverage</h2>
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

    <MissingMusicDecisionInspector v-if="selectedDecisionId" :decision-id="selectedDecisionId" />

    <MissingMusicDecisionWorklist />

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

</template>

<style scoped>
.missing-music-page-title:focus {
  outline: 2px solid var(--hx-accent);
  outline-offset: 3px;
}
</style>
