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

import assert from 'node:assert/strict';
import test from 'node:test';
import { useRequestListFilters } from '../../src/client/composables/useRequestListFilters.js';

test('initializes with empty filters', () => {
  const { filters, activeFilterCount, hasActiveFilters } = useRequestListFilters();

  assert.equal(filters.requestState, '');
  assert.equal(filters.requestKind, '');
  assert.equal(filters.search, '');
  assert.equal(activeFilterCount.value, 0);
  assert.equal(hasActiveFilters.value, false);
});

test('updateFilter sets a single field', () => {
  const { filters, updateFilter } = useRequestListFilters();

  updateFilter('requestState', 'needs_fetch');
  assert.equal(filters.requestState, 'needs_fetch');
  assert.equal(filters.requestKind, '');
  assert.equal(filters.search, '');
});

test('updateFilter sets multiple fields independently', () => {
  const { filters, updateFilter } = useRequestListFilters();

  updateFilter('requestState', 'needs_fetch');
  updateFilter('requestKind', 'track');
  updateFilter('search', 'daft punk');

  assert.equal(filters.requestState, 'needs_fetch');
  assert.equal(filters.requestKind, 'track');
  assert.equal(filters.search, 'daft punk');
});

test('activeFilterCount counts non-empty filters', () => {
  const { filters, activeFilterCount, updateFilter } = useRequestListFilters();

  updateFilter('requestState', 'needs_fetch');
  assert.equal(activeFilterCount.value, 1);

  updateFilter('requestKind', 'release');
  assert.equal(activeFilterCount.value, 2);

  updateFilter('search', 'test');
  assert.equal(activeFilterCount.value, 3);
});

test('activeFilterCount ignores whitespace-only search', () => {
  const { activeFilterCount, updateFilter } = useRequestListFilters();

  updateFilter('search', '   ');
  assert.equal(activeFilterCount.value, 0);
});

test('hasActiveFilters reflects filter state', () => {
  const { hasActiveFilters, updateFilter } = useRequestListFilters();

  assert.equal(hasActiveFilters.value, false);

  updateFilter('requestState', 'already_exists');
  assert.equal(hasActiveFilters.value, true);
});

test('resetFilters clears all fields', () => {
  const { filters, activeFilterCount, updateFilter, resetFilters } = useRequestListFilters();

  updateFilter('requestState', 'needs_fetch');
  updateFilter('requestKind', 'track');
  updateFilter('search', 'daft');
  assert.equal(activeFilterCount.value, 3);

  resetFilters();
  assert.equal(filters.requestState, '');
  assert.equal(filters.requestKind, '');
  assert.equal(filters.search, '');
  assert.equal(activeFilterCount.value, 0);
});

test('toApiParams omits empty fields', () => {
  const { toApiParams } = useRequestListFilters();

  assert.deepEqual(toApiParams(), {});
});

test('toApiParams includes only non-empty filters', () => {
  const { toApiParams, updateFilter } = useRequestListFilters();

  updateFilter('requestState', 'needs_fetch');
  updateFilter('search', 'daft punk');

  const params = toApiParams();
  assert.equal(params.requestState, 'needs_fetch');
  assert.equal(params.search, 'daft punk');
  assert.equal(Object.prototype.hasOwnProperty.call(params, 'requestKind'), false);
});

test('toApiParams trims search', () => {
  const { toApiParams, updateFilter } = useRequestListFilters();

  updateFilter('search', '  daft  ');
  assert.equal(toApiParams().search, 'daft');
});

test('applyFilters calls the provided callback', () => {
  let called = false;
  const { applyFilters } = useRequestListFilters({
    applyFiltersFn: () => { called = true; },
  });

  applyFilters();
  assert.equal(called, true);
});

test('updateFilter ignores unknown fields', () => {
  const { filters, updateFilter } = useRequestListFilters();

  updateFilter('unknownField', 'value');
  assert.equal(Object.prototype.hasOwnProperty.call(filters, 'unknownField'), false);
});

test('sortBy is included in empty filter state', () => {
  const { filters } = useRequestListFilters();
  assert.equal(filters.sortBy, '');
});

test('sortBy is not counted in activeFilterCount', () => {
  const { activeFilterCount, updateFilter } = useRequestListFilters();
  updateFilter('sortBy', 'oldest');
  assert.equal(activeFilterCount.value, 0);
});

test('resetFilters clears sortBy', () => {
  const { filters, updateFilter, resetFilters } = useRequestListFilters();
  updateFilter('sortBy', 'state');
  resetFilters();
  assert.equal(filters.sortBy, '');
});

test('sortRequests returns same order when sortBy is empty (newest default)', () => {
  const { sortRequests } = useRequestListFilters();
  const requests = [
    { id: '1', createdAt: '2026-01-01' },
    { id: '2', createdAt: '2026-06-01' },
  ];
  const result = sortRequests(requests);
  assert.equal(result[0].id, '1');
  assert.equal(result[1].id, '2');
});

test('sortRequests sorts by oldest first', () => {
  const { sortRequests, updateFilter } = useRequestListFilters();
  updateFilter('sortBy', 'oldest');
  const requests = [
    { id: '1', createdAt: '2026-06-01' },
    { id: '2', createdAt: '2026-01-01' },
    { id: '3', createdAt: '2026-03-01' },
  ];
  const result = sortRequests(requests);
  assert.equal(result[0].id, '2');
  assert.equal(result[1].id, '3');
  assert.equal(result[2].id, '1');
});

test('sortRequests sorts by state', () => {
  const { sortRequests, updateFilter } = useRequestListFilters();
  updateFilter('sortBy', 'state');
  const requests = [
    { id: '1', requestState: 'needs_fetch' },
    { id: '2', requestState: 'already_exists' },
    { id: '3', requestState: 'needs_review' },
  ];
  const result = sortRequests(requests);
  assert.equal(result[0].id, '2');
  assert.equal(result[1].id, '1');
  assert.equal(result[2].id, '3');
});

test('sortRequests sorts by kind', () => {
  const { sortRequests, updateFilter } = useRequestListFilters();
  updateFilter('sortBy', 'kind');
  const requests = [
    { id: '1', requestKind: 'release' },
    { id: '2', requestKind: 'track' },
    { id: '3', requestKind: 'external_url' },
  ];
  const result = sortRequests(requests);
  assert.equal(result[0].id, '3');
  assert.equal(result[1].id, '1');
  assert.equal(result[2].id, '2');
});

test('sortRequests does not mutate the original array', () => {
  const { sortRequests, updateFilter } = useRequestListFilters();
  updateFilter('sortBy', 'oldest');
  const requests = [
    { id: '1', createdAt: '2026-06-01' },
    { id: '2', createdAt: '2026-01-01' },
  ];
  const result = sortRequests(requests);
  assert.equal(result[0].id, '2');
  assert.equal(requests[0].id, '1');
});
