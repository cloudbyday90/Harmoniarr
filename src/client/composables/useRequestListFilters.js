/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { computed, reactive } from 'vue';

const EMPTY_FILTER_STATE = {
  requestKind: '',
  requestState: '',
  search: '',
};

export function useRequestListFilters({
  applyFiltersFn = null,
} = {}) {
  const filters = reactive({ ...EMPTY_FILTER_STATE });

  const activeFilterCount = computed(() => {
    let count = 0;
    if (filters.requestState) count++;
    if (filters.requestKind) count++;
    if (filters.search.trim()) count++;
    return count;
  });

  const hasActiveFilters = computed(() => activeFilterCount.value > 0);

  function updateFilter(field, value) {
    if (field in filters) {
      filters[field] = value;
    }
  }

  function resetFilters() {
    Object.assign(filters, EMPTY_FILTER_STATE);
  }

  function applyFilters() {
    if (typeof applyFiltersFn === 'function') {
      applyFiltersFn();
    }
  }

  function toApiParams() {
    const params = {};
    if (filters.requestState) params.requestState = filters.requestState;
    if (filters.requestKind) params.requestKind = filters.requestKind;
    if (filters.search.trim()) params.search = filters.search.trim();
    return params;
  }

  return {
    activeFilterCount,
    applyFilters,
    filters,
    hasActiveFilters,
    resetFilters,
    toApiParams,
    updateFilter,
  };
}
