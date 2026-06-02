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

<!--
  GridControls — stateless v-model filter/sort toolbar.

  Props:
    modelValue: GridFilterState  — { sort: { field, order }, filters: Record<string, string|string[]> }
    sortOptions: { value, label }[]
    filterGroups: { key, label, options: { value, label }[] }[]
    isDefault: boolean  — drives "Clear all" visibility
    isLoading: boolean  — shows spinner badge on the controls bar

  Emits:
    update:modelValue(newState: GridFilterState)
    clearAll()

  This component holds NO internal state. All persistence is owned by useGridState
  via URL query params. It simply translates user interactions into emitted state.
-->

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
  sortOptions: {
    type: Array,
    default: () => [],
  },
  filterGroups: {
    type: Array,
    default: () => [],
  },
  isDefault: {
    type: Boolean,
    default: true,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'clearAll']);

// ── Sort ──────────────────────────────────────────────────────────────────────

const currentSortField = computed(() => props.modelValue.sort.field);
const currentSortOrder = computed(() => props.modelValue.sort.order);

function onSortFieldChange(event) {
  emit('update:modelValue', {
    ...props.modelValue,
    sort: { ...props.modelValue.sort, field: event.target.value },
  });
}

function toggleSortOrder() {
  emit('update:modelValue', {
    ...props.modelValue,
    sort: {
      ...props.modelValue.sort,
      order: props.modelValue.sort.order === 'asc' ? 'desc' : 'asc',
    },
  });
}

// ── Filters ───────────────────────────────────────────────────────────────────

const hasActiveFilters = computed(
  () => Object.keys(props.modelValue.filters).length > 0,
);

const activeFilterCount = computed(() => Object.keys(props.modelValue.filters).length);

/** Active filter pills: { key, label, valueLabel } */
const activeFilterPills = computed(() => {
  const pills = [];
  for (const [key, value] of Object.entries(props.modelValue.filters)) {
    const group = props.filterGroups.find((g) => g.key === key);
    if (!group) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      const option = group.options.find((o) => o.value === v);
      pills.push({
        key,
        value: v,
        groupLabel: group.label,
        valueLabel: option?.label ?? v,
      });
    }
  }
  return pills;
});

function clearFilter(key) {
  const { [key]: _removed, ...rest } = props.modelValue.filters;
  emit('update:modelValue', {
    ...props.modelValue,
    filters: rest,
  });
}

function clearAll() {
  emit('clearAll');
}

function setFilter(key, value) {
  emit('update:modelValue', {
    ...props.modelValue,
    filters: {
      ...props.modelValue.filters,
      [key]: value,
    },
  });
}

// ── Filter panel ──────────────────────────────────────────────────────────────

const filterPanelOpen = ref(false);

function toggleFilterPanel() {
  filterPanelOpen.value = !filterPanelOpen.value;
}

function closeFilterPanel() {
  filterPanelOpen.value = false;
}

// ── Accessible order label ─────────────────────────────────────────────────────

const sortOrderLabel = computed(() =>
  currentSortOrder.value === 'asc' ? 'Ascending — click to sort descending' : 'Descending — click to sort ascending',
);
</script>

<template>
  <div class="grid-controls" :class="{ 'grid-controls--loading': isLoading }">
    <!-- Left: sort controls -->
    <div class="grid-controls-sort">
      <label class="grid-controls-sort-label" for="grid-sort-select">Sort</label>
      <select
        id="grid-sort-select"
        class="grid-controls-sort-select"
        :value="currentSortField"
        @change="onSortFieldChange"
        :aria-label="`Sort by ${currentSortField}`"
      >
        <option
          v-for="option in sortOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>

      <button
        type="button"
        class="grid-controls-order-btn"
        :aria-label="sortOrderLabel"
        :title="sortOrderLabel"
        @click="toggleSortOrder"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="grid-controls-order-icon"
          :class="{ 'is-asc': currentSortOrder === 'asc' }"
        >
          <!-- Down arrow (desc) / Up arrow (asc) via CSS rotation -->
          <polyline points="4 6 8 10 12 6" />
        </svg>
      </button>
    </div>

    <!-- Right: filter trigger + active pills -->
    <div class="grid-controls-filters">
      <!-- Active filter pills -->
      <template v-if="hasActiveFilters">
        <div class="grid-controls-pills" role="group" aria-label="Active filters">
          <button
            v-for="pill in activeFilterPills"
            :key="`${pill.key}-${pill.value}`"
            type="button"
            class="grid-controls-pill"
            :aria-label="`Remove filter: ${pill.groupLabel} ${pill.valueLabel}`"
            @click="clearFilter(pill.key)"
          >
            <span class="grid-controls-pill-text">
              <span class="grid-controls-pill-group">{{ pill.groupLabel }}:</span>
              {{ pill.valueLabel }}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              aria-hidden="true"
              class="grid-controls-pill-x"
            >
              <line x1="2" y1="2" x2="10" y2="10" />
              <line x1="10" y1="2" x2="2" y2="10" />
            </svg>
          </button>

        </div>
      </template>

      <button
        v-if="!isDefault"
        type="button"
        class="grid-controls-clear-all"
        @click="clearAll"
      >
        Clear all
      </button>

      <!-- Filter panel trigger (only shown when there are filter groups) -->
      <div v-if="filterGroups.length > 0" class="grid-controls-filter-trigger-wrap">
        <button
          type="button"
          class="grid-controls-filter-btn"
          :class="{ 'has-filters': hasActiveFilters }"
          :aria-expanded="filterPanelOpen"
          aria-controls="grid-filter-panel"
          @click="toggleFilterPanel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            class="grid-controls-filter-icon"
          >
            <line x1="2" y1="4" x2="14" y2="4" />
            <line x1="4" y1="8" x2="12" y2="8" />
            <line x1="6" y1="12" x2="10" y2="12" />
          </svg>
          Filters
          <span v-if="activeFilterCount > 0" class="grid-controls-filter-badge" aria-label=", {{ activeFilterCount }} active">
            {{ activeFilterCount }}
          </span>
        </button>

        <!-- Filter dropdown panel -->
        <div
          v-if="filterPanelOpen"
          id="grid-filter-panel"
          class="grid-controls-panel"
          role="dialog"
          aria-label="Filter options"
        >
          <div v-for="group in filterGroups" :key="group.key" class="grid-controls-panel-group">
            <p class="grid-controls-panel-group-label">{{ group.label }}</p>
            <div class="grid-controls-panel-options" role="group" :aria-label="group.label">
              <button
                v-for="option in group.options"
                :key="option.value"
                type="button"
                class="grid-controls-panel-option"
                :class="{ 'is-active': modelValue.filters[group.key] === option.value }"
                :aria-pressed="modelValue.filters[group.key] === option.value"
                @click="setFilter(group.key, option.value); closeFilterPanel();"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div v-if="!isDefault" class="grid-controls-panel-footer">
            <button
              type="button"
              class="grid-controls-panel-clear"
              @click="clearAll(); closeFilterPanel();"
            >
              Clear all
            </button>
          </div>
        </div>
      </div>

      <!-- Loading indicator -->
      <span
        v-if="isLoading"
        class="grid-controls-loading-badge"
        aria-label="Loading results"
        aria-live="polite"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          aria-hidden="true"
          class="grid-controls-spinner"
        >
          <circle cx="8" cy="8" r="6" stroke-dasharray="20 20" />
        </svg>
      </span>
    </div>
  </div>
</template>

<style scoped>
.grid-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-3);
  padding: var(--hx-space-2) 0;
  flex-wrap: wrap;
}

/* ── Sort ─────────────────────────────────────────────────────────────────── */

.grid-controls-sort {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
}

.grid-controls-sort-label {
  font-size: var(--hx-font-size-sm);
  color: var(--hx-text-muted);
  font-weight: 500;
  white-space: nowrap;
}

.grid-controls-sort-select {
  appearance: none;
  -webkit-appearance: none;
  background: var(--hx-bg-raised);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius);
  color: var(--hx-text);
  font-size: var(--hx-font-size-sm);
  padding: var(--hx-space-1) var(--hx-space-3) var(--hx-space-1) var(--hx-space-2);
  cursor: pointer;
  min-width: 120px;
}

.grid-controls-sort-select:focus {
  outline: 2px solid var(--hx-accent);
  outline-offset: 1px;
}

.grid-controls-order-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--hx-bg-raised);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius);
  color: var(--hx-text-muted);
  cursor: pointer;
  padding: 0;
  transition: color 0.1s, border-color 0.1s;
}

.grid-controls-order-btn:hover {
  color: var(--hx-text);
  border-color: var(--hx-border-strong);
}

.grid-controls-order-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.15s;
}

.grid-controls-order-icon.is-asc {
  transform: rotate(180deg);
}

/* ── Filters ──────────────────────────────────────────────────────────────── */

.grid-controls-filters {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

.grid-controls-pills {
  display: flex;
  align-items: center;
  gap: var(--hx-space-1);
  flex-wrap: wrap;
}

.grid-controls-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--hx-space-1);
  padding: 2px var(--hx-space-2) 2px var(--hx-space-2);
  background: color-mix(in srgb, var(--hx-accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--hx-accent) 30%, transparent);
  border-radius: 999px;
  font-size: var(--hx-font-size-xs);
  color: var(--hx-text);
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
}

.grid-controls-pill:hover {
  background: color-mix(in srgb, var(--hx-accent) 20%, transparent);
  border-color: var(--hx-accent);
}

.grid-controls-pill-group {
  color: var(--hx-text-muted);
}

.grid-controls-pill-text {
  white-space: nowrap;
}

.grid-controls-pill-x {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  opacity: 0.7;
}

.grid-controls-clear-all {
  background: none;
  border: none;
  color: var(--hx-text-muted);
  font-size: var(--hx-font-size-xs);
  cursor: pointer;
  padding: 2px var(--hx-space-1);
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: color 0.1s, text-decoration-color 0.1s;
}

.grid-controls-clear-all:hover {
  color: var(--hx-text);
  text-decoration-color: currentColor;
}

/* ── Filter button + panel ────────────────────────────────────────────────── */

.grid-controls-filter-trigger-wrap {
  position: relative;
}

.grid-controls-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--hx-space-1);
  padding: var(--hx-space-1) var(--hx-space-3);
  background: var(--hx-bg-raised);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius);
  color: var(--hx-text-muted);
  font-size: var(--hx-font-size-sm);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.1s, border-color 0.1s;
}

.grid-controls-filter-btn:hover,
.grid-controls-filter-btn[aria-expanded="true"] {
  color: var(--hx-text);
  border-color: var(--hx-border-strong);
}

.grid-controls-filter-btn.has-filters {
  border-color: color-mix(in srgb, var(--hx-accent) 50%, transparent);
  color: var(--hx-text);
}

.grid-controls-filter-icon {
  width: 14px;
  height: 14px;
}

.grid-controls-filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  background: var(--hx-accent);
  border-radius: 999px;
  color: white;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}

.grid-controls-panel {
  position: absolute;
  top: calc(100% + var(--hx-space-1));
  right: 0;
  z-index: 100;
  min-width: 220px;
  background: var(--hx-bg-surface);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-lg);
  box-shadow: var(--hx-shadow-md);
  padding: var(--hx-space-3);
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-3);
}

.grid-controls-panel-group {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-2);
}

.grid-controls-panel-group-label {
  font-size: var(--hx-font-size-xs);
  font-weight: 600;
  color: var(--hx-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.grid-controls-panel-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-1);
}

.grid-controls-panel-option {
  padding: 3px var(--hx-space-2);
  background: var(--hx-bg-raised);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius);
  font-size: var(--hx-font-size-sm);
  color: var(--hx-text-muted);
  cursor: pointer;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.grid-controls-panel-option:hover {
  background: var(--hx-bg-hover);
  color: var(--hx-text);
  border-color: var(--hx-border-strong);
}

.grid-controls-panel-option.is-active {
  background: color-mix(in srgb, var(--hx-accent) 15%, transparent);
  border-color: var(--hx-accent);
  color: var(--hx-text);
}

.grid-controls-panel-footer {
  border-top: 1px solid var(--hx-border-subtle);
  padding-top: var(--hx-space-2);
}

.grid-controls-panel-clear {
  background: none;
  border: none;
  color: var(--hx-text-muted);
  font-size: var(--hx-font-size-sm);
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: color 0.1s, text-decoration-color 0.1s;
}

.grid-controls-panel-clear:hover {
  color: var(--hx-text);
  text-decoration-color: currentColor;
}

/* ── Loading ──────────────────────────────────────────────────────────────── */

.grid-controls-loading-badge {
  display: inline-flex;
  align-items: center;
  color: var(--hx-text-muted);
}

.grid-controls-spinner {
  width: 14px;
  height: 14px;
  animation: gc-spin 0.8s linear infinite;
}

@keyframes gc-spin {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -40; }
}

/* ── Mobile ─────────────────────────────────────────────────────────────── */

/*
 * The filter panel is position: absolute; right: 0.  On a narrow phone the
 * parent .grid-controls-filter-trigger-wrap may be near the left edge of the
 * screen, so "right: 0" aligns the panel's right edge to the trigger — but
 * the panel's min-width (220px) then pushes it off the left edge.
 *
 * Fix: switch to left: 0 alignment so the panel grows rightward from the
 * trigger, which always has space to the right on mobile.
 */
@media (max-width: 640px) {
  .grid-controls-panel {
    right: auto;
    left: 0;
  }
}
</style>
