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
import RequestStageProgressBar from './RequestStageProgressBar.vue';
import { journeyStatusLabel, journeyStatusTone } from '../lib/request-journey.js';

const props = defineProps({
  stages: {
    type: Array,
    default: () => [],
  },
  currentStageKey: {
    type: String,
    default: null,
  },
});

const currentStage = computed(
  () => props.stages.find((stage) => stage.key === props.currentStageKey) ?? null,
);

const announcement = computed(() => {
  const stage = currentStage.value;
  if (!stage) return '';
  return `${stage.label}: ${journeyStatusLabel(stage.status)}. ${stage.detail}`;
});
</script>

<template>
  <div class="rjt">
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
    <ol class="rjt-list" aria-label="Request journey">
      <li
        v-for="stage in stages"
        :key="stage.key"
        class="rjt-step"
        :data-status="stage.status"
        :aria-current="stage.key === currentStageKey ? 'step' : undefined"
      >
        <span class="rjt-marker" aria-hidden="true">
          <span class="rjt-dot"></span>
        </span>
        <span class="rjt-body">
          <span class="rjt-heading">
            <span class="rjt-label">{{ stage.label }}</span>
            <span class="hx-pill" :data-tone="journeyStatusTone(stage.status)">{{ journeyStatusLabel(stage.status) }}</span>
          </span>
          <span class="rjt-detail">{{ stage.detail }}</span>
          <RequestStageProgressBar
            v-if="stage.progress"
            :label="`${stage.label} progress`"
            :progress="stage.progress"
          />
        </span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.rjt-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.rjt-step {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--hx-space-3, 0.75rem);
  padding-bottom: var(--hx-space-4, 1rem);
}

.rjt-step:last-child {
  padding-bottom: 0;
}

.rjt-marker {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
}

/* Connector line between markers. */
.rjt-step:not(:last-child) .rjt-marker::after {
  content: '';
  position: absolute;
  top: 1.1rem;
  bottom: calc(-1 * var(--hx-space-4, 1rem));
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: var(--hx-border, rgba(148, 163, 184, 0.35));
}

.rjt-dot {
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 50%;
  background: var(--hx-surface-2, #1e293b);
  border: 2px solid var(--hx-border, rgba(148, 163, 184, 0.5));
  z-index: 1;
}

.rjt-step[data-status='complete'] .rjt-dot {
  background: var(--hx-success, #22c55e);
  border-color: var(--hx-success, #22c55e);
}

.rjt-step[data-status='active'] .rjt-dot {
  background: var(--hx-warning, #f59e0b);
  border-color: var(--hx-warning, #f59e0b);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--hx-warning, #f59e0b) 25%, transparent);
}

.rjt-step[data-status='failed'] .rjt-dot {
  background: var(--hx-danger, #ef4444);
  border-color: var(--hx-danger, #ef4444);
}

.rjt-step[data-status='cancelled'] .rjt-dot,
.rjt-step[data-status='skipped'] .rjt-dot {
  background: var(--hx-surface-2, #1e293b);
  border-style: dashed;
}

.rjt-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.rjt-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--hx-space-2, 0.5rem);
}

.rjt-label {
  font-weight: 600;
  color: var(--hx-text, #e2e8f0);
}

.rjt-step[data-status='pending'] .rjt-label,
.rjt-step[data-status='skipped'] .rjt-label,
.rjt-step[data-status='cancelled'] .rjt-label {
  color: var(--hx-text-muted, #94a3b8);
}

.rjt-detail {
  font-size: 0.85rem;
  color: var(--hx-text-muted, #94a3b8);
}
</style>
