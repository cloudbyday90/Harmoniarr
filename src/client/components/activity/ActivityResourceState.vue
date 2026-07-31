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

const props = defineProps({
  actionDisabled: {
    type: Boolean,
    default: false,
  },
  actionLabel: {
    type: String,
    default: null,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  description: {
    type: String,
    default: null,
  },
  skeletonLines: {
    type: Number,
    default: 4,
  },
  state: {
    type: String,
    required: true,
    validator: (value) => ['empty', 'error', 'loading'].includes(value),
  },
  title: {
    type: String,
    required: true,
  },
});

defineEmits(['action']);

const isError = computed(() => props.state === 'error');
const isLoading = computed(() => props.state === 'loading');
const announcementRole = computed(() => (isError.value ? 'alert' : 'status'));
const announcementPoliteness = computed(() => (isError.value ? 'assertive' : 'polite'));
const skeletonLineIndexes = computed(() => Array.from(
  { length: Math.max(1, props.skeletonLines) },
  (_, index) => index,
));
</script>

<template>
  <section
    class="activity-resource-state"
    :class="{ 'activity-resource-state--compact': compact }"
    :data-state="state"
    :aria-atomic="true"
    :aria-busy="isLoading ? 'true' : undefined"
    :aria-live="announcementPoliteness"
    :role="announcementRole"
  >
    <template v-if="isLoading">
      <p class="activity-resource-state__loading-label">{{ title }}</p>
      <div class="activity-resource-state__skeletons" aria-hidden="true">
        <span
          v-for="index in skeletonLineIndexes"
          :key="index"
          class="hx-skeleton"
          :data-size="index === 0 ? 'lg' : undefined"
        />
      </div>
    </template>

    <div v-else class="hx-empty">
      <h3 class="hx-empty-title">{{ title }}</h3>
      <p v-if="description" class="hx-empty-copy">{{ description }}</p>
      <div v-if="actionLabel" class="hx-empty-actions">
        <button
          type="button"
          class="hx-btn"
          data-variant="primary"
          :disabled="actionDisabled"
          @click="$emit('action')"
        >
          {{ actionLabel }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.activity-resource-state {
  min-width: 0;
}

.activity-resource-state[data-state='loading'] {
  display: grid;
  gap: var(--hx-space-3);
  padding: var(--hx-space-4);
}

.activity-resource-state__loading-label {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.activity-resource-state__skeletons {
  display: grid;
  gap: var(--hx-space-2);
}

.activity-resource-state--compact .hx-empty {
  align-items: flex-start;
  gap: var(--hx-space-2);
  padding: var(--hx-space-3) var(--hx-space-4);
  text-align: left;
}

.activity-resource-state--compact .hx-empty-actions {
  justify-content: flex-start;
  margin-top: 0;
}

.activity-resource-state[data-state='error'] .hx-empty {
  border-color: color-mix(in oklab, var(--hx-danger) 45%, var(--hx-border));
}
</style>
