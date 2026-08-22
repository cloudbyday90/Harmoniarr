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
import { computed, ref } from 'vue';
import { formatMetadataProviderCacheBaselineCapture } from '../lib/metadata-provider-cache-baseline-capture.js';
import { formatMetadataProviderCacheTimestamp } from '../lib/metadata-provider-cache-observability-presentation.js';
import { writePlainTextToClipboard } from '../lib/plain-text-clipboard-service.js';

const props = defineProps({
  cacheBaseline: {
    type: Object,
    default: null,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  baselineComparison: {
    type: Object,
    default: null,
  },
  hasComparisonStart: {
    type: Boolean,
    default: false,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['clear-comparison-start', 'mark-comparison-start', 'refresh']);

const copyStatus = ref('');
const comparisonStatus = ref('');
const canMarkComparisonStart = computed(() => Boolean(props.cacheBaseline?.observedSinceAt));
const observedSinceLabel = computed(() => formatMetadataProviderCacheTimestamp(props.cacheBaseline?.observedSinceAt));
const updatedAtLabel = computed(() => formatMetadataProviderCacheTimestamp(props.cacheBaseline?.updatedAt));

function formatPercentage(value) {
  return Number.isSafeInteger(value) ? `${value}%` : 'No samples';
}

function formatDuration(value) {
  return Number.isSafeInteger(value) ? `${value} ms` : 'Not recorded';
}

function requestRefresh() {
  copyStatus.value = '';
  comparisonStatus.value = '';
  emit('refresh');
}

function markComparisonStart() {
  if (!canMarkComparisonStart.value || props.isLoading) {
    return;
  }

  emit('mark-comparison-start');
  comparisonStatus.value = 'Comparison start marked. Refresh diagnostics after active use to compare this process window.';
}

function clearComparisonStart() {
  emit('clear-comparison-start');
  comparisonStatus.value = 'Comparison start cleared.';
}

function formatComparisonUnavailableMessage(comparison) {
  switch (comparison?.code) {
    case 'comparison_counter_regressed':
      return 'Comparison unavailable because a cumulative cache counter reset. Clear the start and begin a new process-local pair.';
    case 'comparison_process_window_changed':
      return 'Comparison unavailable because the server process changed. Clear the start and begin a new process-local pair.';
    case 'comparison_sample_order_invalid':
      return 'Comparison unavailable because the refreshed diagnostic sample is older than the marked start. Refresh diagnostics again.';
    default:
      return 'Comparison unavailable because the process observation boundary is missing. Load a new diagnostic baseline before marking a start.';
  }
}

async function copyBaselineSummary() {
  if (!props.cacheBaseline || props.isLoading) {
    return;
  }

  try {
    await writePlainTextToClipboard(formatMetadataProviderCacheBaselineCapture(props.cacheBaseline));
    copyStatus.value = 'Baseline summary copied. Save it only in an approved operator record.';
  } catch {
    copyStatus.value = 'Clipboard access was unavailable. Use the displayed diagnostic values instead.';
  }
}
</script>

<template>
  <article class="hx-card" aria-labelledby="metadata-cache-baseline-title">
    <header class="hx-card-header metadata-provider-cache-baseline-panel__header">
      <div>
        <h3 id="metadata-cache-baseline-title" class="hx-card-title">Artist Detail cache baseline</h3>
        <p class="hx-card-subtitle">On-demand, process-local cache evidence for administrators. It does not persist in the browser or prove cross-instance behaviour.</p>
      </div>
      <div class="hx-card-actions metadata-provider-cache-baseline-panel__actions">
        <button type="button" class="hx-btn" data-variant="primary" :disabled="isLoading" @click="requestRefresh">
          {{ isLoading ? 'Loading…' : cacheBaseline ? 'Refresh diagnostics' : 'Load diagnostics' }}
        </button>
        <button v-if="cacheBaseline" type="button" class="hx-btn" :disabled="isLoading" @click="copyBaselineSummary">
          Copy baseline summary
        </button>
        <button
          v-if="cacheBaseline && !hasComparisonStart"
          type="button"
          class="hx-btn"
          :disabled="isLoading || !canMarkComparisonStart"
          @click="markComparisonStart"
        >
          Mark comparison start
        </button>
        <button v-else-if="cacheBaseline" type="button" class="hx-btn" :disabled="isLoading" @click="clearComparisonStart">
          Clear comparison start
        </button>
      </div>
    </header>

    <div class="hx-card-body">
      <p v-if="errorMessage" class="hx-text-muted" role="alert">{{ errorMessage }}</p>
      <p v-if="copyStatus" class="hx-text-muted" role="status">{{ copyStatus }}</p>
      <p v-if="comparisonStatus" class="hx-text-muted" role="status">{{ comparisonStatus }}</p>

      <div v-if="isLoading && !cacheBaseline" class="hx-skeleton-stack" aria-live="polite" aria-label="Loading cache diagnostics">
        <span class="hx-skeleton" data-size="sm"></span>
        <span class="hx-skeleton"></span>
      </div>

      <template v-else-if="cacheBaseline">
        <p class="hx-text-muted">
          This process has observed cache activity since {{ observedSinceLabel }}. Last aggregate update: {{ updatedAtLabel }}.
        </p>

        <section class="hx-stat-grid" aria-label="Artist Detail cache baseline summary">
          <div class="hx-stat">
            <span class="hx-stat-label">CACHE SERVED</span>
            <span class="hx-stat-value">{{ formatPercentage(cacheBaseline.totals.cacheServedRatePercent) }}</span>
            <span class="hx-stat-meta">{{ cacheBaseline.totals.cacheServedLookups }} of {{ cacheBaseline.totals.totalLookups }} lookups</span>
          </div>
          <div class="hx-stat">
            <span class="hx-stat-label">COLD LOOKUPS</span>
            <span class="hx-stat-value">{{ formatPercentage(cacheBaseline.totals.coldLookupRatePercent) }}</span>
            <span class="hx-stat-meta">{{ cacheBaseline.totals.coldLookups }} provider-blocking lookups</span>
          </div>
          <div class="hx-stat">
            <span class="hx-stat-label">REFRESH FAILURES</span>
            <span class="hx-stat-value">{{ formatPercentage(cacheBaseline.totals.refreshFailureRatePercent) }}</span>
            <span class="hx-stat-meta">{{ cacheBaseline.totals.refreshFailureCount }} of {{ cacheBaseline.totals.completedRefreshCount }} completed</span>
          </div>
          <div class="hx-stat">
            <span class="hx-stat-label">ACTIVE / STORE ERRORS</span>
            <span class="hx-stat-value">{{ cacheBaseline.totals.activeRefreshCount }} / {{ cacheBaseline.totals.cacheStoreErrorCount }}</span>
            <span class="hx-stat-meta">Refresh work in flight / cache-store errors</span>
          </div>
        </section>

        <section
          v-if="hasComparisonStart && baselineComparison?.canCompare"
          aria-labelledby="metadata-cache-comparison-title"
        >
          <h4 id="metadata-cache-comparison-title" class="hx-card-title">Paired sample comparison</h4>
          <p class="hx-text-muted">
            Interval changes since the marked baseline in this process window ({{ formatMetadataProviderCacheTimestamp(baselineComparison.observedSinceAt) }}).
          </p>

          <div class="hx-stat-grid" aria-label="Artist Detail cache paired-sample comparison summary">
            <div class="hx-stat">
              <span class="hx-stat-label">LOOKUPS ADDED</span>
              <span class="hx-stat-value">{{ baselineComparison.totals.totalLookups }}</span>
              <span class="hx-stat-meta">{{ baselineComparison.totals.freshLookups }} fresh / {{ baselineComparison.totals.staleLookups }} stale / {{ baselineComparison.totals.coldLookups }} cold</span>
            </div>
            <div class="hx-stat">
              <span class="hx-stat-label">CACHE SERVED</span>
              <span class="hx-stat-value">{{ formatPercentage(baselineComparison.totals.cacheServedRatePercent) }}</span>
              <span class="hx-stat-meta">{{ baselineComparison.totals.cacheServedLookups }} of {{ baselineComparison.totals.totalLookups }} added lookups</span>
            </div>
            <div class="hx-stat">
              <span class="hx-stat-label">REFRESH FAILURES</span>
              <span class="hx-stat-value">{{ formatPercentage(baselineComparison.totals.refreshFailureRatePercent) }}</span>
              <span class="hx-stat-meta">{{ baselineComparison.totals.refreshFailureCount }} of {{ baselineComparison.totals.completedRefreshCount }} completed refreshes</span>
            </div>
            <div class="hx-stat">
              <span class="hx-stat-label">ACTIVE / STORE ERRORS</span>
              <span class="hx-stat-value">{{ baselineComparison.totals.activeRefreshCount }} / {{ baselineComparison.totals.cacheStoreErrorCount }}</span>
              <span class="hx-stat-meta">Current refresh work / interval cache-store errors</span>
            </div>
          </div>

          <div v-if="baselineComparison.namespaces.length" class="hx-table-scroll">
            <table class="hx-table">
              <thead>
                <tr>
                  <th scope="col">Cache namespace</th>
                  <th scope="col">Lookups added (fresh / stale / cold)</th>
                  <th scope="col">Cache served</th>
                  <th scope="col">Refreshes added</th>
                  <th scope="col">Current active refreshes</th>
                  <th scope="col">Store errors added</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="namespace in baselineComparison.namespaces" :key="namespace.cacheNamespace">
                  <td>{{ namespace.cacheNamespace }}</td>
                  <td>{{ namespace.freshLookups }} / {{ namespace.staleLookups }} / {{ namespace.coldLookups }}</td>
                  <td>{{ formatPercentage(namespace.cacheServedRatePercent) }}</td>
                  <td>{{ namespace.completedRefreshCount }} completed, {{ namespace.refreshFailureCount }} failed</td>
                  <td>{{ namespace.activeRefreshCount }}</td>
                  <td>{{ namespace.cacheStoreErrorCount }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <p v-else-if="hasComparisonStart" class="hx-text-muted" role="status">
          {{ formatComparisonUnavailableMessage(baselineComparison) }}
        </p>

        <div v-if="!cacheBaseline.namespaces.length" class="hx-empty">
          <h4 class="hx-empty-title">No provider cache activity yet</h4>
          <p class="hx-empty-copy">Open an Artist Detail discography or related artists section, then refresh diagnostics to record the process-local baseline.</p>
        </div>

        <div v-else class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th scope="col">Cache namespace</th>
                <th scope="col">Lookups (fresh / stale / cold)</th>
                <th scope="col">Cache served</th>
                <th scope="col">Refreshes</th>
                <th scope="col">Latest refresh</th>
                <th scope="col">Last duration (foreground / background)</th>
                <th scope="col">Store errors</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="namespace in cacheBaseline.namespaces" :key="namespace.cacheNamespace">
                <td>{{ namespace.cacheNamespace }}</td>
                <td>{{ namespace.freshLookups }} / {{ namespace.staleLookups }} / {{ namespace.coldLookups }}</td>
                <td>{{ formatPercentage(namespace.cacheServedRatePercent) }}</td>
                <td>{{ namespace.completedRefreshCount }} completed, {{ namespace.refreshFailureCount }} failed, {{ namespace.activeRefreshCount }} active</td>
                <td>{{ formatMetadataProviderCacheTimestamp(namespace.lastRefreshAt) }}</td>
                <td>{{ formatDuration(namespace.refreshes.foreground.lastDurationMs) }} / {{ formatDuration(namespace.refreshes.background.lastDurationMs) }}</td>
                <td>{{ namespace.cacheStoreErrorCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <div v-else class="hx-empty">
        <h4 class="hx-empty-title">Diagnostics are not loaded</h4>
        <p class="hx-empty-copy">Load a snapshot after normal Artist Detail use. Compare only samples from the same process window before considering broader telemetry or distributed refresh coordination.</p>
      </div>
    </div>
  </article>
</template>

<style scoped>
.metadata-provider-cache-baseline-panel__actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

@media (max-width: 760px) {
  .metadata-provider-cache-baseline-panel__header {
    flex-direction: column;
  }

  .metadata-provider-cache-baseline-panel__actions {
    justify-content: flex-start;
  }
}
</style>
