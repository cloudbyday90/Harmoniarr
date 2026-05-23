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
  sortBy: '',
};

const ALLOWED_SORT_KEYS = new Set(['newest', 'oldest', 'state', 'kind']);

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

  function getSortComparator() {
    switch (filters.sortBy) {
      case 'oldest':
        return (a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
      case 'state':
        return (a, b) => (a.requestState ?? '').localeCompare(b.requestState ?? '');
      case 'kind':
        return (a, b) => (a.requestKind ?? '').localeCompare(b.requestKind ?? '');
      case 'newest':
      default:
        return (a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    }
  }

  function sortRequests(requests) {
    if (!ALLOWED_SORT_KEYS.has(filters.sortBy) || filters.sortBy === 'newest') {
      return requests;
    }
    return [...requests].sort(getSortComparator());
  }

  return {
    activeFilterCount,
    applyFilters,
    filters,
    hasActiveFilters,
    resetFilters,
    sortRequests,
    toApiParams,
    updateFilter,
  };
}
