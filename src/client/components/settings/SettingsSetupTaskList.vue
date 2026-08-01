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
import { RouterLink } from 'vue-router';

const props = defineProps({
  headingLevel: {
    default: 4,
    type: Number,
    validator: (value) => Number.isInteger(value) && value >= 1 && value <= 6,
  },
  idPrefix: {
    default: 'settings-setup-task',
    type: String,
  },
  label: {
    required: true,
    type: String,
  },
  steps: {
    default: () => [],
    type: Array,
  },
});

const headingTag = computed(() => `h${props.headingLevel}`);

function buildStepId(step, suffix) {
  return `${props.idPrefix}-${step.id}-${suffix}`;
}
</script>

<template>
  <ol class="settings-setup-task-list" :aria-label="label">
    <li v-for="step in steps" :key="step.id" class="settings-setup-task-list__item">
      <RouterLink
        class="settings-setup-task-list__link"
        :aria-describedby="`${buildStepId(step, 'status')} ${buildStepId(step, 'copy')}`"
        :to="{ name: step.routeName }"
      >
        <span class="settings-setup-task-list__content">
          <component :is="headingTag" class="settings-setup-task-list__title">{{ step.title }}</component>
          <span :id="buildStepId(step, 'copy')" class="settings-setup-task-list__copy">{{ step.copy }}</span>
        </span>
        <span class="settings-setup-task-list__state">
          <span :id="buildStepId(step, 'status')" class="hx-pill" :data-tone="step.tone">{{ step.status }}</span>
          <span class="settings-setup-task-list__destination" aria-hidden="true">{{ step.label }}</span>
        </span>
      </RouterLink>
    </li>
  </ol>
</template>

<style scoped>
.settings-setup-task-list {
  list-style: none;
  margin: var(--hx-space-2) 0 0;
  padding: 0;
}

.settings-setup-task-list__item {
  border-top: 1px solid var(--hx-border-subtle);
}

.settings-setup-task-list__link {
  align-items: center;
  color: inherit;
  display: flex;
  gap: var(--hx-space-4);
  justify-content: space-between;
  padding: var(--hx-space-3) 0;
  text-decoration: none;
}

.settings-setup-task-list__link:focus-visible {
  border-radius: var(--hx-radius-xs);
  outline: 2px solid var(--hx-accent);
  outline-offset: 2px;
}

.settings-setup-task-list__content {
  display: grid;
  gap: var(--hx-space-1);
  min-width: 0;
}

.settings-setup-task-list__title {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-sm);
  margin: 0;
}

.settings-setup-task-list__copy,
.settings-setup-task-list__destination {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.settings-setup-task-list__state {
  align-items: flex-end;
  display: grid;
  flex: 0 0 auto;
  gap: var(--hx-space-1);
  justify-items: end;
  text-align: right;
}

.settings-setup-task-list__destination {
  color: var(--hx-accent-strong);
}

@media (max-width: 640px) {
  .settings-setup-task-list__link {
    align-items: flex-start;
    flex-direction: column;
  }

  .settings-setup-task-list__state {
    align-items: flex-start;
    justify-items: start;
    text-align: left;
  }
}
</style>
