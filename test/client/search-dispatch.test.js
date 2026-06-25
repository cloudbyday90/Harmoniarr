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
import { resolveSearchDispatch } from '../../src/client/lib/search-dispatch.js';

// ── min-length gate ───────────────────────────────────────────────────────────

test('resolveSearchDispatch rejects a query below the minimum length', () => {
  const r = resolveSearchDispatch({ query: 'a', lastQuery: '', minLength: 2 });
  assert.equal(r.dispatch, false);
  assert.equal(r.reason, 'short');
  assert.equal(r.deferMs, 0);
});

test('resolveSearchDispatch trims whitespace before the length check', () => {
  assert.equal(resolveSearchDispatch({ query: '  ab  ', minLength: 2 }).dispatch, true);
  assert.equal(resolveSearchDispatch({ query: '   ', minLength: 2 }).reason, 'short');
  assert.equal(resolveSearchDispatch({ query: ' a ', minLength: 2 }).reason, 'short');
});

test('resolveSearchDispatch defaults minLength to 2', () => {
  assert.equal(resolveSearchDispatch({ query: 'ab' }).dispatch, true);
  assert.equal(resolveSearchDispatch({ query: 'a' }).reason, 'short');
});

// ── de-dupe gate ──────────────────────────────────────────────────────────────

test('resolveSearchDispatch rejects a query identical to the last dispatched one', () => {
  const r = resolveSearchDispatch({ query: 'radiohead', lastQuery: 'radiohead', minLength: 2 });
  assert.equal(r.dispatch, false);
  assert.equal(r.reason, 'unchanged');
});

test('resolveSearchDispatch treats trimmed-equal queries as duplicates', () => {
  assert.equal(
    resolveSearchDispatch({ query: '  radiohead ', lastQuery: 'radiohead', minLength: 2 }).reason,
    'unchanged',
  );
});

test('resolveSearchDispatch dispatches a different query', () => {
  assert.equal(
    resolveSearchDispatch({ query: 'portishead', lastQuery: 'radiohead', minLength: 2 }).dispatch,
    true,
  );
});

// ── rate-limit gate ───────────────────────────────────────────────────────────

test('resolveSearchDispatch rate-limits and reports the remaining defer window', () => {
  const r = resolveSearchDispatch({
    query: 'beatles',
    lastQuery: 'beat',
    minLength: 2,
    minIntervalMs: 1000,
    elapsedMs: 400,
  });
  assert.equal(r.dispatch, false);
  assert.equal(r.reason, 'rate-limited');
  assert.equal(r.deferMs, 600);
});

test('resolveSearchDispatch dispatches once the interval has elapsed', () => {
  const r = resolveSearchDispatch({
    query: 'beatles',
    lastQuery: 'beat',
    minLength: 2,
    minIntervalMs: 1000,
    elapsedMs: 1000,
  });
  assert.equal(r.dispatch, true);
  assert.equal(r.reason, 'ok');
});

test('resolveSearchDispatch treats no prior dispatch (Infinity elapsed) as eligible', () => {
  const r = resolveSearchDispatch({
    query: 'initial',
    minIntervalMs: 1000,
  });
  assert.equal(r.dispatch, true);
});

// ── gate ordering ─────────────────────────────────────────────────────────────

test('min-length takes precedence over de-dupe', () => {
  // 'a' equals lastQuery but is also too short — short wins.
  assert.equal(
    resolveSearchDispatch({ query: 'a', lastQuery: 'a', minLength: 2 }).reason,
    'short',
  );
});

test('de-dupe takes precedence over rate-limit', () => {
  // Same query but within the rate window — unchanged wins (no need to defer).
  assert.equal(
    resolveSearchDispatch({
      query: 'same',
      lastQuery: 'same',
      minIntervalMs: 1000,
      elapsedMs: 10,
    }).reason,
    'unchanged',
  );
});

// ── robustness ────────────────────────────────────────────────────────────────

test('resolveSearchDispatch handles a non-string query as short', () => {
  assert.equal(resolveSearchDispatch({ query: undefined }).reason, 'short');
  assert.equal(resolveSearchDispatch({ query: null }).reason, 'short');
  assert.equal(resolveSearchDispatch({ query: 42 }).reason, 'short');
});

test('resolveSearchDispatch treats a non-finite minIntervalMs as no rate limit', () => {
  const r = resolveSearchDispatch({
    query: 'xy',
    lastQuery: 'yz',
    minIntervalMs: Number.NaN,
    elapsedMs: 0,
  });
  assert.equal(r.dispatch, true);
});
