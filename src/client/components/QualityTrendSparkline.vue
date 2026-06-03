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
import {
  buildSparklineEndpoint,
  buildSparklinePath,
  formatQualityAverage,
  formatSignalLabel,
  formatTrendCharacterization,
  formatTrendLabel,
  formatTrendTone,
} from '../lib/source-user-quality-trend-presentation.js';

const props = defineProps({
  trend: { type: Object, default: null },
});

const WIDTH = 168;
const HEIGHT = 44;

const hasSeries = computed(() => Array.isArray(props.trend?.series) && props.trend.series.length > 0);
const sparklinePath = computed(() => buildSparklinePath({ series: props.trend?.series, width: WIDTH, height: HEIGHT }));
const endpoint = computed(() => buildSparklineEndpoint({ series: props.trend?.series, width: WIDTH, height: HEIGHT }));
const trendLabel = computed(() => formatTrendLabel(props.trend?.trendDirection));
const trendTone = computed(() => formatTrendTone(props.trend?.trendDirection));
const characterization = computed(() => formatTrendCharacterization(props.trend));
const recentAverage = computed(() => formatQualityAverage(props.trend?.recentAverage));
const lifetimeAverage = computed(() => formatQualityAverage(props.trend?.lifetimeAverage));
const signalMix = computed(() => (Array.isArray(props.trend?.signalMix) ? props.trend.signalMix : []));
</script>

<template>
  <section v-if="trend" class="quality-trend">
    <div class="quality-trend-header">
      <p class="ops-section-label">Delivered-quality trend</p>
      <span class="hx-pill" :data-tone="trendTone">{{ trendLabel }}</span>
    </div>

    <div v-if="hasSeries" class="quality-trend-chart">
      <svg
        class="quality-trend-sparkline"
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        :width="WIDTH"
        :height="HEIGHT"
        role="img"
        :aria-label="`Delivered-quality sparkline, ${trendLabel.toLowerCase()}`"
        preserveAspectRatio="none"
      >
        <path class="quality-trend-line" :d="sparklinePath" fill="none" />
        <circle
          v-if="endpoint"
          class="quality-trend-endpoint"
          :cx="endpoint.x"
          :cy="endpoint.y"
          r="2.5"
        />
      </svg>
      <div class="quality-trend-averages">
        <div class="quality-trend-average">
          <span class="hx-stat-label">RECENT</span>
          <span class="quality-trend-average-value">{{ recentAverage }}</span>
        </div>
        <div class="quality-trend-average">
          <span class="hx-stat-label">LIFETIME</span>
          <span class="quality-trend-average-value">{{ lifetimeAverage }}</span>
        </div>
      </div>
    </div>

    <p v-else class="hx-text-muted quality-trend-empty">No delivered-quality evidence recorded yet.</p>

    <p v-if="characterization" class="hx-text-muted quality-trend-copy">{{ characterization }}</p>

    <div v-if="signalMix.length > 0" class="quality-trend-signals">
      <span
        v-for="signal in signalMix"
        :key="signal.label"
        class="hx-pill"
        data-tone="warning"
      >{{ formatSignalLabel(signal.label) }} · {{ signal.count }}</span>
    </div>
  </section>
</template>

<style scoped>
.quality-trend {
  display: grid;
  gap: var(--hx-space-2);
  margin-bottom: var(--hx-space-4);
  padding: var(--hx-space-3);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-md);
  background: var(--hx-surface-muted);
}

.quality-trend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-2);
}

.quality-trend-chart {
  display: flex;
  align-items: center;
  gap: var(--hx-space-4);
}

.quality-trend-sparkline {
  flex: 1 1 auto;
  min-width: 0;
  height: 44px;
}

.quality-trend-line {
  stroke: var(--hx-accent);
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.quality-trend-endpoint {
  fill: var(--hx-accent);
}

.quality-trend-averages {
  display: flex;
  gap: var(--hx-space-3);
  flex: 0 0 auto;
}

.quality-trend-average {
  display: grid;
  gap: 2px;
  text-align: right;
}

.quality-trend-average-value {
  font-size: var(--hx-text-sm);
  color: var(--hx-text-strong);
}

.quality-trend-copy,
.quality-trend-empty {
  margin: 0;
}

.quality-trend-signals {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}
</style>
