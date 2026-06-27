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
//
// Opt-in `roving` enables W3C-APG roving tabindex over the rendered cells: one
// cell is the single tab stop into the grid, arrow/Home/End keys move focus, and
// the rest are removed from the tab order. The index/intent math lives in
// roving-index.js; this component only wires the composable and re-syncs the
// managed tabindex after every reveal or list change.
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import {
  clampVisibleCount,
  resolveNextVisibleCount,
  resolveRemainingCount,
} from '../../lib/paginated-list.js';
import { useRovingTabindex } from '../../composables/useRovingTabindex.js';

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
  // When true, the grid manages roving tabindex over its cells (one tab stop,
  // arrow-key navigation). Off by default for backward compatibility.
  roving: {
    type: Boolean,
    default: false,
  },
  // Selector for the focusable cell within each slotted item. Defaults to the
  // media card's navigable link area.
  cellSelector: {
    type: String,
    default: '.hx-media-card__link-area',
  },
  // Secondary controls in inactive cards should not appear before the active
  // roving card when tabbing into the grid. The active card's controls keep
  // native focusability so keyboard users can still reach actions like Add.
  managedControlSelector: {
    type: String,
    default: '.hx-media-card__actions :is(a[href], button, input, select, textarea, [tabindex])',
  },
});

const visibleCount = ref(clampVisibleCount(props.initialVisible, props.items.length, props.step));

const gridEl = useTemplateRef('grid');
const { refresh: refreshRoving } = useRovingTabindex(() => gridEl.value, {
  cellSelector: props.cellSelector,
  managedControlSelector: props.managedControlSelector,
  enabled: () => props.roving,
});

// When the source list changes (re-ranked recommendations, new search), keep the
// reveal window valid and avoid showing a stale "Show more" affordance. After
// the DOM re-renders, re-apply the managed tabindex to the new cell nodes.
watch(() => props.items.length, (total) => {
  visibleCount.value = clampVisibleCount(visibleCount.value, total, props.step);
  if (props.roving) {
    nextTick(refreshRoving);
  }
});

const visibleItems = computed(() => props.items.slice(0, visibleCount.value));
const remainingCount = computed(() => resolveRemainingCount(visibleCount.value, props.items.length));
const hasMore = computed(() => remainingCount.value > 0);

function keyFor(item, index) {
  return item?.[props.itemKey] ?? index;
}

function showMore() {
  visibleCount.value = resolveNextVisibleCount(visibleCount.value, props.items.length, props.step);
  // Newly revealed cards render without a managed tabindex until the next sync.
  if (props.roving) {
    nextTick(refreshRoving);
  }
}
</script>

<template>
  <div class="discover-paginated">
    <ul
      ref="grid"
      class="hx-artwork-grid discover-grid"
      role="list"
      :aria-label="ariaLabel || undefined"
    >
      <li
        v-for="(item, index) in visibleItems"
        :key="keyFor(item, index)"
      >
        <slot :item="item" :index="index" />
      </li>
    </ul>

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
  /* The native <ul> reset and > li{display:contents} live on the shared
     .hx-artwork-grid primitive now; this override only sets the cell floor. */
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
