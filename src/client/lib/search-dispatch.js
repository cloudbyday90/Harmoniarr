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

/**
 * Pure, DOM-free decision logic for debounced search dispatch.
 *
 * The debounce *timing* (waiting for a quiet period) lives in the
 * `useDebouncedSearch` composable; this module owns only the value-level
 * decision of whether a query should actually be dispatched once the quiet
 * period has elapsed. Isolating it makes the gating rules unit-testable with
 * the native Node runner.
 *
 * Three gates, in order:
 *   1. **min-length** — the trimmed query must meet `minLength` (avoid
 *      half-typed/noise queries).
 *   2. **de-dupe** — the trimmed query must differ from the last *dispatched*
 *      query (avoid re-firing an identical search).
 *   3. **rate-limit** — at least `minIntervalMs` must have elapsed since the
 *      last dispatch (MusicBrainz asks for ~1 request/second). When this fails,
 *      `deferMs` tells the caller how long to wait before retrying the same
 *      query.
 *
 * @typedef {('ok'|'short'|'unchanged'|'rate-limited')} SearchDispatchReason
 */

/**
 * Decide whether to dispatch a search for `query`.
 *
 * @param {object} input
 * @param {string} input.query - The current query text.
 * @param {string} [input.lastQuery=''] - The last successfully dispatched query
 *   (already trimmed by the caller, or compared trimmed here).
 * @param {number} [input.minLength=2] - Minimum trimmed length to dispatch.
 * @param {number} [input.minIntervalMs=0] - Minimum ms between dispatches.
 * @param {number} [input.elapsedMs=Infinity] - Ms since the last dispatch.
 * @returns {{ dispatch: boolean, reason: SearchDispatchReason, deferMs: number }}
 *   `deferMs` is > 0 only when rate-limited.
 */
export function resolveSearchDispatch({
  query,
  lastQuery = '',
  minLength = 2,
  minIntervalMs = 0,
  elapsedMs = Infinity,
} = {}) {
  const trimmed = typeof query === 'string' ? query.trim() : '';
  const floor = Number.isFinite(minLength) && minLength > 0 ? minLength : 1;

  if (trimmed.length < floor) {
    return { dispatch: false, reason: 'short', deferMs: 0 };
  }

  const last = typeof lastQuery === 'string' ? lastQuery.trim() : '';
  if (last === trimmed) {
    return { dispatch: false, reason: 'unchanged', deferMs: 0 };
  }

  const interval = Number.isFinite(minIntervalMs) && minIntervalMs > 0 ? minIntervalMs : 0;
  const elapsed = Number.isFinite(elapsedMs) ? elapsedMs : Infinity;
  if (elapsed < interval) {
    return { dispatch: false, reason: 'rate-limited', deferMs: interval - elapsed };
  }

  return { dispatch: true, reason: 'ok', deferMs: 0 };
}
