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
 * Pure, DOM-free roving-tabindex navigation math.
 *
 * Implements the W3C APG "roving tabindex" practice for a composite widget
 * (here: a `role="list"` artwork grid). The composite keeps exactly one cell
 * in the tab order (`tabindex="0"`); the rest are `tabindex="-1"` and are
 * reached with arrow keys. Because these cards are *navigable links* (not
 * tabular data), the container stays `role="list"` — the full ARIA `grid`
 * role is deliberately avoided (it would announce meaningless rows/columns
 * for what are effectively list items).
 *
 * This module owns only the value-level decision so it can be unit-tested with
 * the native Node runner. The component/composable performs the DOM reads
 * (cell list, column count) and the `.focus()` call.
 *
 * References:
 *   - W3C APG — Keyboard Interface Practices § Roving Tabindex
 *   - W3C APG — Grid Pattern (arrow / Home / End / Ctrl+Home / Ctrl+End intents)
 */

/**
 * The set of semantic navigation intents the roving index understands.
 *
 * `next`/`prev` move along the inline axis; `up`/`down` move by one row
 * (column stride); `row-start`/`row-end` jump to the row edges; `first`/
 * `last` jump to the grid edges.
 *
 * @typedef {('next'|'prev'|'up'|'down'|'row-start'|'row-end'|'first'|'last')} RovingIntent
 */

/**
 * Map a keyboard event's primitive properties to a semantic roving intent.
 *
 * Honors the platform "grid-wide" modifier for Home/End:
 *   - `Home` / `End`  → first/last cell of the current row (`row-start`/`row-end`)
 *   - `Ctrl+Home` / `Ctrl+End` (or `Cmd` on macOS) → first/last cell of the grid
 *
 * The `axis` constrains which arrows are active (W3C APG Toolbar guidance: a
 * horizontal arrangement navigates with Left/Right only; a vertical one with
 * Up/Down only). In a 1-D list (`horizontal`/`vertical`) there is no row
 * concept, so Home/End are always grid-scoped (`first`/`last`); only `grid`
 * distinguishes row-scoped Home/End from Ctrl/Cmd grid-scoped Home/End.
 *
 * Returns `null` for any key that is not a roving-navigation key (or is off the
 * active axis), so the caller can leave the event untouched (e.g. let a
 * character key bubble, or let Up/Down scroll in a horizontal band).
 *
 * @param {object} descriptor
 * @param {string} descriptor.key - The `KeyboardEvent.key` value.
 * @param {boolean} [descriptor.ctrlKey=false] - Whether Ctrl was held.
 * @param {boolean} [descriptor.metaKey=false] - Whether Cmd (macOS) was held.
 * @param {('grid'|'horizontal'|'vertical')} [descriptor.axis='grid']
 *   Active navigation axis. `grid` (default) enables all four arrows; the 1-D
 *   modes restrict movement to a single axis pair.
 * @returns {RovingIntent|null} The intent, or `null` when the key is not handled.
 */
export function resolveRovingIntent({ key, ctrlKey = false, metaKey = false, axis = 'grid' } = {}) {
  if (typeof key !== 'string') {
    return null;
  }
  const gridWide = ctrlKey === true || metaKey === true;
  // In a 1-D list there is no row, so Home/End are always grid-scoped.
  const isLinear = axis === 'horizontal' || axis === 'vertical';
  switch (key) {
    case 'ArrowRight':
      return axis === 'vertical' ? null : 'next';
    case 'ArrowLeft':
      return axis === 'vertical' ? null : 'prev';
    case 'ArrowDown':
      return axis === 'horizontal' ? null : 'down';
    case 'ArrowUp':
      return axis === 'horizontal' ? null : 'up';
    case 'Home':
      return !isLinear && !gridWide ? 'row-start' : 'first';
    case 'End':
      return !isLinear && !gridWide ? 'row-end' : 'last';
    default:
      return null;
  }
}

/**
 * Resolve the next active index for a roving-tabindex composite.
 *
 * Movement model (platform icon-grid convention, e.g. file-manager grids):
 *   - **Horizontal** (`next`/`prev`) is *linear* — it follows document flow and
 *     wraps across row boundaries, so a keyboard user can traverse the entire
 *     grid with one key regardless of the responsive column count. It stops only
 *     at the first/last cell of the whole grid.
 *   - **Vertical** (`up`/`down`) moves by the column stride and *stops* at the
 *     top and bottom rows (no overshoot). When the target row is partial, `down`
 *     clamps to the last item rather than skipping past it.
 *   - `row-start`/`row-end` jump to the current row edges; `first`/`last` jump
 *     to the grid edges.
 *
 * Row geometry is derived from the column stride: the start of `current`'s row
 * is `current - (current % columns)`, and the bottom row is the row that
 * contains the last item.
 *
 * Contract:
 *   - Returns `null` when `intent` is unknown/null or the grid is empty.
 *   - Clamps `current` into `[0, total - 1]` first, so an out-of-range active
 *     index (e.g. after items shrank) never overflows.
 *   - Columns are clamped to `[1, total]`; a single-column layout degrades to a
 *     purely linear list, which is still correct.
 *
 * @param {number} current - The currently active 0-based index (clamped if stale).
 * @param {RovingIntent|null} intent - The intent from `resolveRovingIntent`.
 * @param {number} columns - Resolved column count for the current layout (>= 1).
 * @param {number} total - Total number of focusable cells (>= 0).
 * @returns {number|null} The new active index in `[0, total - 1]`, or `null`.
 */
export function resolveRovingIndex(current, intent, columns, total) {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  if (safeTotal === 0 || intent == null) {
    return null;
  }
  const cols = Math.min(
    Number.isFinite(columns) && columns > 0 ? Math.floor(columns) : 1,
    safeTotal,
  );
  const start = Number.isFinite(current)
    ? Math.max(0, Math.min(Math.floor(current), safeTotal - 1))
    : 0;
  const rowStart = start - (start % cols);
  const rowEnd = Math.min(rowStart + cols - 1, safeTotal - 1);
  const lastRowStart = safeTotal - 1 - ((safeTotal - 1) % cols);

  switch (intent) {
    case 'next':
      // Linear: crosses row boundaries, stops only at the grid end.
      return Math.min(start + 1, safeTotal - 1);
    case 'prev':
      // Linear: crosses row boundaries, stops only at the grid start.
      return Math.max(start - 1, 0);
    case 'down':
      // Column stride; no move when already in the bottom row.
      return rowStart >= lastRowStart ? start : Math.min(start + cols, safeTotal - 1);
    case 'up':
      // Column stride; no move when already in the top row.
      return rowStart === 0 ? start : Math.max(start - cols, 0);
    case 'row-start':
      return rowStart;
    case 'row-end':
      return rowEnd;
    case 'first':
      return 0;
    case 'last':
      return safeTotal - 1;
    default:
      return null;
  }
}
