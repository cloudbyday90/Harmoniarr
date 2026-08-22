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
import { computed } from 'vue';
import { formatMetadataProviderCacheTimestamp } from '../lib/metadata-provider-cache-observability-presentation.js';

const props = defineProps({
  cacheBaseline: {
    type: Object,
    default: null,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['refresh']);

const observedSinceLabel = computed(() => formatMetadataProviderCacheTimestamp(props.cacheBaseline?.observedSinceAt));
const updatedAtLabel = computed(() => formatMetadataProviderCacheTimestamp(props.cacheBaseline?.updatedAt));

function formatPercentage(value) {
  return Number.isSafeInteger(value) ? `${value}%` : 'No samples';
}

function formatDuration(value) {
  return Number.isSafeInteger(value) ? `${value} ms` : 'Not recorded';
}
</script>

<template>
  <article class="hx-card" aria-labelledby="metadata-cache-baseline-title">
    <header class="hx-card-header">
      <div>
        <h3 id="metadata-cache-baseline-title" class="hx-card-title">Artist Detail cache baseline</h3>
        <p class="hx-card-subtitle">On-demand, process-local cache evidence for administrators. It does not persist in the browser or prove cross-instance behaviour.</p>
      </div>
      <div class="hx-card-actions">
        <button type="button" class="hx-btn" data-variant="primary" :disabled="isLoading" @click="$emit('refresh')">
          {{ isLoading ? 'Loading…' : cacheBaseline ? 'Refresh diagnostics' : 'Load diagnostics' }}
        </button>
      </div>
    </header>

    <div class="hx-card-body">
      <p v-if="errorMessage" class="hx-text-muted" role="alert">{{ errorMessage }}</p>

      <div v-else-if="isLoading && !cacheBaseline" class="hx-skeleton-stack" aria-live="polite" aria-label="Loading cache diagnostics">
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

        <div v-if="!cacheBaseline.namespaces.length" class="hx-empty">
          <h4 class="hx-empty-title">No provider cache activity yet</h4>
          <p class="hx-empty-copy">Open an Artist Detail discography or related-artists section, then refresh diagnostics to record the process-local baseline.</p>
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
