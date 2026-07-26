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
import { buildMusicQueueOverviewPresentation } from '../../lib/music-queue-overview-presentation.js';

const props = defineProps({
  summaryCards: {
    default: () => [],
    type: Array,
  },
});

const presentation = computed(() => buildMusicQueueOverviewPresentation(props.summaryCards));
</script>

<template>
  <section
    v-if="presentation.isVisible"
    class="music-queue-overview"
    :class="{
      'has-attention': presentation.facts.some((fact) => fact.tone === 'warning'),
    }"
    aria-label="Music Queue overview"
  >
    <div>
      <p class="hx-eyebrow">{{ presentation.eyebrow }}</p>
      <h2>{{ presentation.headline }}</h2>
      <p>{{ presentation.detail }}</p>
    </div>

    <ul class="music-queue-overview__facts" aria-label="Active queue states">
      <li v-for="fact in presentation.facts" :key="fact.key" :data-tone="fact.tone">
        <strong>{{ fact.value }}</strong>
        <span>{{ fact.label }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.music-queue-overview {
  align-items: center;
  background: var(--hx-bg-surface);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-sm);
  display: grid;
  gap: var(--hx-space-4);
  grid-template-columns: minmax(0, 1fr) auto;
  padding: var(--hx-space-4) var(--hx-space-5);
}

.music-queue-overview.has-attention {
  border-color: var(--hx-warning);
}

.music-queue-overview h2,
.music-queue-overview p {
  margin: 0;
}

.music-queue-overview h2 {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-lg);
}

.music-queue-overview p:not(.hx-eyebrow) {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  margin-top: var(--hx-space-1);
}

.music-queue-overview__facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-3);
  justify-content: flex-end;
  list-style: none;
  margin: 0;
  padding: 0;
}

.music-queue-overview__facts li {
  align-items: baseline;
  color: var(--hx-text-muted);
  display: flex;
  gap: var(--hx-space-1);
  white-space: nowrap;
}

.music-queue-overview__facts li[data-tone='warning'] {
  color: var(--hx-warning);
  font-weight: 700;
}

.music-queue-overview__facts strong {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-lg);
}

.music-queue-overview__facts li[data-tone='warning'] strong {
  color: currentColor;
}

@media (max-width: 720px) {
  .music-queue-overview {
    align-items: start;
    grid-template-columns: 1fr;
  }

  .music-queue-overview__facts {
    justify-content: flex-start;
  }
}
</style>
