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
// Reusable artwork grid with incremental "show more" reveal.
//
// Owns only the visible-count state; every count transition is delegated to the
// pure helpers in paginated-list.js so the reveal logic is unit-tested without a
// DOM. Each visible item is exposed back to the parent through a scoped slot, so
// callers keep full control over what a card looks like while sharing one tested
// list/paging implementation.
import { computed, ref, watch } from 'vue';
import {
  clampVisibleCount,
  resolveNextVisibleCount,
  resolveRemainingCount,
} from '../../lib/paginated-list.js';

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  itemKey: {
    type: String,
    default: 'id',
  },
  initialVisible: {
    type: Number,
    default: 12,
  },
  step: {
    type: Number,
    default: 12,
  },
  ariaLabel: {
    type: String,
    default: '',
  },
});

const visibleCount = ref(clampVisibleCount(props.initialVisible, props.items.length, props.step));

// When the source list changes (re-ranked recommendations, new search), keep the
// reveal window valid and avoid showing a stale "Show more" affordance.
watch(
  () => props.items.length,
  (total) => {
    visibleCount.value = clampVisibleCount(visibleCount.value, total, props.step);
  },
);

const visibleItems = computed(() => props.items.slice(0, visibleCount.value));
const remainingCount = computed(() => resolveRemainingCount(visibleCount.value, props.items.length));
const hasMore = computed(() => remainingCount.value > 0);

function keyFor(item, index) {
  return item?.[props.itemKey] ?? index;
}

function showMore() {
  visibleCount.value = resolveNextVisibleCount(visibleCount.value, props.items.length, props.step);
}
</script>

<template>
  <div class="discover-paginated">
    <div class="hx-artwork-grid discover-grid" role="list" :aria-label="ariaLabel || undefined">
      <slot
        v-for="(item, index) in visibleItems"
        :key="keyFor(item, index)"
        :item="item"
        :index="index"
      />
    </div>

    <div v-if="hasMore" class="discover-paginated__more">
      <button
        type="button"
        class="hx-btn"
        data-variant="ghost"
        @click="showMore"
      >
        Show {{ Math.min(step, remainingCount) }} more
        <span class="discover-paginated__remaining">({{ remainingCount }} remaining)</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.discover-paginated {
  display: grid;
  gap: var(--hx-space-3);
}

.discover-grid {
  --hx-artwork-grid-min: 180px;
}

.discover-grid :deep(.hx-media-card) {
  cursor: default;
}

.discover-paginated__more {
  display: flex;
  justify-content: center;
}

.discover-paginated__remaining {
  margin-left: 0.4rem;
  color: var(--hx-text-muted);
  font-weight: 500;
}

@media (max-width: 640px) {
  .discover-grid {
    --hx-artwork-grid-min: 140px;
  }
}
</style>
