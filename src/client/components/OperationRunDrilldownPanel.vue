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
import { buildOperationRunDrilldown } from '../lib/operation-run-drilldown-presentation.js';
import { formatOperationTimestampShort } from '../lib/operation-run-presentation.js';

const props = defineProps({
  run: {
    type: Object,
    default: null,
  },
});

const drilldown = computed(() => buildOperationRunDrilldown(props.run));

function formatCellValue(key, value) {
  if (key === 'startedAt' || key === 'finishedAt') {
    return value === '—' ? value : formatOperationTimestampShort(value);
  }

  return value == null || value === '' ? '—' : value;
}
</script>

<template>
  <section v-if="drilldown" class="ops-drilldown">
    <p class="ops-section-label">Recorded detail</p>

    <div class="ops-drilldown-metrics" v-if="drilldown.metrics?.length">
      <article v-for="metric in drilldown.metrics" :key="metric.label" class="ops-drilldown-metric">
        <span class="ops-drilldown-metric-label">{{ metric.label }}</span>
        <span class="ops-drilldown-metric-value">
          <span v-if="metric.tone" class="hx-pill" :data-tone="metric.tone">{{ metric.value }}</span>
          <template v-else>{{ metric.value }}</template>
        </span>
        <span class="ops-drilldown-metric-meta">{{ metric.meta }}</span>
      </article>
    </div>

    <section v-for="table in drilldown.tables" :key="table.key" class="ops-drilldown-section">
      <div class="ops-drilldown-section-header">
        <strong>{{ table.title }}</strong>
        <p class="hx-text-muted">{{ table.description }}</p>
      </div>

      <div class="hx-table-scroll">
        <table class="hx-table ops-drilldown-table">
          <thead>
            <tr>
              <th v-for="column in table.columns" :key="column.key">{{ column.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in table.rows" :key="row.id">
              <td v-for="column in table.columns" :key="column.key">
                <span v-if="column.key === 'status' || column.key === 'state'">
                  <span class="hx-pill" :data-tone="row[`${column.key}Tone`] ?? null">{{ formatCellValue(column.key, row[column.key]) }}</span>
                </span>
                <span v-else class="ops-drilldown-cell">{{ formatCellValue(column.key, row[column.key]) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<style scoped>
.ops-drilldown {
  display: grid;
  gap: var(--hx-space-4);
  margin-top: var(--hx-space-4);
}

.ops-drilldown-metrics {
  display: grid;
  gap: var(--hx-space-3);
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.ops-drilldown-metric {
  display: grid;
  gap: 4px;
  padding: var(--hx-space-3);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface-sunken);
}

.ops-drilldown-metric-label {
  font-size: var(--hx-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--hx-text-faint);
}

.ops-drilldown-metric-value {
  font-size: var(--hx-text-base);
  color: var(--hx-text-strong);
}

.ops-drilldown-metric-meta {
  font-size: var(--hx-text-xs);
  color: var(--hx-text-muted);
}

.ops-drilldown-section {
  display: grid;
  gap: var(--hx-space-2);
}

.ops-drilldown-section-header {
  display: grid;
  gap: 2px;
}

.ops-drilldown-section-header p {
  margin: 0;
}

.ops-drilldown-table th,
.ops-drilldown-table td {
  vertical-align: top;
}

.ops-drilldown-cell {
  display: inline-block;
  min-width: 0;
  overflow-wrap: anywhere;
}
@media (max-width: 720px) {
  .ops-drilldown-metrics {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
