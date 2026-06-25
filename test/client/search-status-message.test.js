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
import { buildSearchStatusMessage } from '../../src/client/lib/search-status-message.js';

// ── quiet states (no announcement) ───────────────────────────────────────────

test('buildSearchStatusMessage is quiet before any search has run', () => {
  assert.equal(buildSearchStatusMessage({ count: 0, hasSearched: false }), '');
  assert.equal(buildSearchStatusMessage({ count: 5, hasSearched: false }), '');
});

test('buildSearchStatusMessage is quiet while a search is in flight', () => {
  assert.equal(buildSearchStatusMessage({ count: 0, isSearching: true, hasSearched: true }), '');
  // Even if stale results are present, mid-flight stays quiet (no typeahead spam).
  assert.equal(buildSearchStatusMessage({ count: 9, isSearching: true, hasSearched: true }), '');
});

test('buildSearchStatusMessage defaults to quiet for a missing descriptor', () => {
  assert.equal(buildSearchStatusMessage(), '');
  assert.equal(buildSearchStatusMessage({}), '');
});

// ── completed-search announcements ───────────────────────────────────────────

test('buildSearchStatusMessage announces a plural result count', () => {
  assert.equal(
    buildSearchStatusMessage({ count: 12, hasSearched: true }),
    '12 artists found',
  );
});

test('buildSearchStatusMessage singularises exactly one result', () => {
  assert.equal(
    buildSearchStatusMessage({ count: 1, hasSearched: true }),
    '1 artist found',
  );
});

test('buildSearchStatusMessage announces "No artists found" for a completed empty search', () => {
  assert.equal(
    buildSearchStatusMessage({ count: 0, hasSearched: true }),
    'No artists found',
  );
});

// ── error ────────────────────────────────────────────────────────────────────

test('buildSearchStatusMessage announces a provided error message', () => {
  assert.equal(
    buildSearchStatusMessage({ count: 0, hasSearched: true, searchError: 'Search failed.' }),
    'Search failed.',
  );
});

test('buildSearchStatusMessage ignores a non-string error', () => {
  assert.equal(
    buildSearchStatusMessage({ count: 3, hasSearched: true, searchError: null }),
    '3 artists found',
  );
});

// ── robustness ───────────────────────────────────────────────────────────────

test('buildSearchStatusMessage coerces a non-finite count to zero', () => {
  assert.equal(
    buildSearchStatusMessage({ count: Number.NaN, hasSearched: true }),
    'No artists found',
  );
});

test('buildSearchStatusMessage treats a negative count as zero', () => {
  assert.equal(
    buildSearchStatusMessage({ count: -3, hasSearched: true }),
    'No artists found',
  );
});

// ── lifecycle walk ───────────────────────────────────────────────────────────

test('a typeahead walk stays quiet mid-flight and announces on completion', () => {
  // pre-search
  assert.equal(buildSearchStatusMessage({ count: 0, hasSearched: false }), '');
  // searching (results cleared)
  assert.equal(buildSearchStatusMessage({ count: 0, isSearching: true, hasSearched: true }), '');
  // completed
  assert.equal(buildSearchStatusMessage({ count: 7, hasSearched: true }), '7 artists found');
});
