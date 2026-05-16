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

import { computed, getCurrentInstance, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validates and sanitises `route.query` against the declared sort options and
 * filter groups. Unknown values fall back to defaults rather than propagating
 * attacker-controlled strings into filter state or server query params.
 *
 * @param {Record<string, string | string[]>} query  Raw route.query object
 * @param {{ sortOptions: Array<{value:string}>, filterGroups: Array<{key:string, options:Array<{value:string}>}>, defaults: GridStateDefaults }} opts
 * @returns {GridFilterState}
 */
export function parseAndValidateQuery(query, { sortOptions, filterGroups, defaults }) {
  const validSortFields = new Set(sortOptions.map((o) => o.value));
  const sortField = validSortFields.has(query.sort) ? query.sort : (defaults.sort?.field ?? 'added');
  const sortOrder =
    query.order === 'asc' || query.order === 'desc' ? query.order : (defaults.sort?.order ?? 'desc');

  const filters = {};
  for (const group of filterGroups) {
    const raw = query[group.key];
    // Vue Router 4 returns string[] for repeated params, string for single
    const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const validValues = new Set(group.options.map((o) => o.value));
    const accepted = values.filter((v) => validValues.has(v));
    if (accepted.length === 1) filters[group.key] = accepted[0]; // v1: single string
    if (accepted.length > 1) filters[group.key] = accepted; // v1.1: string[] safe
  }

  return { sort: { field: sortField, order: sortOrder }, filters };
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Composable that owns filter/sort state for a card-grid view.
 *
 * State is stored in URL query params (not localStorage) because it is
 * navigational — it must be shareable, bookmarkable, and restored by the back
 * button.  All writes use `router.replace` (not push) so filter changes do not
 * pollute the history stack.
 *
 * Injectable deps (`route`, `router`, `storage`) are provided for full
 * testability outside a Vue component context.
 *
 * @param {object} defaults
 * @param {object} defaults.sort
 * @param {string} defaults.sort.field
 * @param {'asc'|'desc'} defaults.sort.order
 * @param {Record<string,string>} [defaults.filters]
 * @param {object} options
 * @param {string[]} options.filterGroupKeys  All filter param keys owned by this view
 * @param {string} [options.restoreKey]       Opt-in sessionStorage restore key (Library only)
 * @param {Array<{value:string,label:string}>} [options.sortOptions]
 * @param {Array<{key:string,label:string,options:Array<{value:string,label:string}>}>} [options.filterGroups]
 * @param {object} [options.route]            Injectable for testing
 * @param {object} [options.router]           Injectable for testing
 * @param {object} [options.storage]          Injectable sessionStorage for testing
 */
export function useGridState(
  defaults = {},
  {
    filterGroupKeys = [],
    restoreKey = null,
    sortOptions = [],
    filterGroups = [],
    route: injectedRoute = null,
    router: injectedRouter = null,
    storage: injectedStorage = null,
  } = {},
) {
  const route = injectedRoute ?? useRoute();
  const router = injectedRouter ?? useRouter();
  const sessionStorage =
    injectedStorage ??
    (typeof globalThis.sessionStorage !== 'undefined' ? globalThis.sessionStorage : null);

  // Normalised defaults with fallbacks
  const defaultSortField = defaults.sort?.field ?? 'added';
  const defaultSortOrder = defaults.sort?.order ?? 'desc';
  const defaultFilters = defaults.filters ?? {};

  // ── Derived filter state (reactive read from URL) ──────────────────────────

  const filterState = computed(() => {
    if (sortOptions.length > 0 || filterGroups.length > 0) {
      return parseAndValidateQuery(route.query, { sortOptions, filterGroups, defaults });
    }
    // Fast path when no option sets are provided (e.g. simple sort-only views)
    const sortField =
      route.query.sort !== undefined ? route.query.sort : defaultSortField;
    const sortOrder =
      route.query.order === 'asc' || route.query.order === 'desc'
        ? route.query.order
        : defaultSortOrder;

    const filters = {};
    for (const key of filterGroupKeys) {
      const val = route.query[key];
      if (val !== undefined) filters[key] = val;
    }
    return { sort: { field: sortField, order: sortOrder }, filters };
  });

  // ── isDefault ──────────────────────────────────────────────────────────────

  const isDefault = computed(() => {
    const state = filterState.value;
    if (state.sort.field !== defaultSortField) return false;
    if (state.sort.order !== defaultSortOrder) return false;
    if (Object.keys(state.filters).length !== Object.keys(defaultFilters).length) return false;
    for (const [k, v] of Object.entries(defaultFilters)) {
      if (state.filters[k] !== v) return false;
    }
    return Object.keys(state.filters).every((k) => defaultFilters[k] === state.filters[k]);
  });

  // ── Writers ────────────────────────────────────────────────────────────────

  /**
   * Merge a partial patch into the current state and write to URL via replace.
   * @param {Partial<GridFilterState>} patch
   */
  function updateState(patch) {
    const current = filterState.value;
    const next = {
      sort: { ...current.sort, ...(patch.sort ?? {}) },
      filters: { ...current.filters, ...(patch.filters ?? {}) },
    };

    // Build the new query: preserve unrelated params, overlay sort + filter keys
    const unrelated = Object.fromEntries(
      Object.entries(route.query).filter(
        ([k]) => k !== 'sort' && k !== 'order' && !filterGroupKeys.includes(k),
      ),
    );

    const filterParams = {};
    for (const [k, v] of Object.entries(next.filters)) {
      if (v !== undefined && v !== null) filterParams[k] = v;
    }

    router.replace({
      query: {
        ...unrelated,
        ...(next.sort.field !== defaultSortField || next.sort.order !== defaultSortOrder
          ? { sort: next.sort.field, order: next.sort.order }
          : {}),
        ...filterParams,
      },
    });
  }

  /**
   * Remove a single filter key from the URL query.
   * @param {string} key
   */
  function clearFilter(key) {
    const { [key]: _removed, ...rest } = route.query;
    router.replace({ query: rest });
  }

  /**
   * Remove all filter and sort keys from the URL, preserving unrelated params.
   */
  function clearAll() {
    const cleaned = Object.fromEntries(
      Object.entries(route.query).filter(
        ([k]) => k !== 'sort' && k !== 'order' && !filterGroupKeys.includes(k),
      ),
    );
    router.replace({ query: cleaned });
  }

  /**
   * Flip the current sort order between asc and desc.
   */
  function toggleSortOrder() {
    updateState({
      sort: { order: filterState.value.sort.order === 'asc' ? 'desc' : 'asc' },
    });
  }

  // ── sessionStorage restore (Library view only) ─────────────────────────────

  const SESSION_KEY = restoreKey ? `grid-state-${restoreKey}` : null;

  function _hasFilterParams() {
    return (
      Object.hasOwn(route.query, 'sort') ||
      Object.hasOwn(route.query, 'order') ||
      filterGroupKeys.some((k) => Object.hasOwn(route.query, k))
    );
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      if (SESSION_KEY && sessionStorage && !_hasFilterParams()) {
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
              router.replace({ query: { ...route.query, ...parsed } });
            }
          } catch {
            // Ignore corrupt saved state
          }
        }
      }
    });

    // Persist non-default state for restore on re-entry
    if (SESSION_KEY && sessionStorage) {
      watch(filterState, (state) => {
        if (SESSION_KEY && !isDefault.value) {
          const toSave = {
            sort: state.sort.field,
            order: state.sort.order,
            ...state.filters,
          };
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(toSave));
        }
      });
    }

    onUnmounted(() => {
      // No cleanup needed — watchers auto-stop
    });
  }

  return {
    clearAll,
    clearFilter,
    filterState,
    isDefault,
    toggleSortOrder,
    updateState,
  };
}
