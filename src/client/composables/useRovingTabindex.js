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

import { onBeforeUnmount, onMounted, watch } from 'vue';
import { resolveRovingIndex, resolveRovingIntent } from '../lib/roving-index.js';

/**
 * Read the resolved column count of a CSS grid container.
 *
 * The artwork grid uses `repeat(auto-fill, minmax(min, 1fr))`, so the column
 * count is a *runtime* property of the rendered layout (it changes with the
 * viewport and container width). We read the browser's resolved
 * `grid-template-columns`, which expands `auto-fill` into N space-separated
 * track values (e.g. `"161px 161px 161px"`), and count them.
 *
 * Returns `1` when the value cannot be read (non-grid container, SSR, or
 * `"none"`), which safely degrades to linear navigation.
 *
 * @param {Element|null} container
 * @returns {number} Column count (>= 1).
 */
function resolveGridColumns(container) {
  if (!container || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return 1;
  }
  const style = window.getComputedStyle(container);
  const tracks =
    style.getPropertyValue('grid-template-columns') || style.gridTemplateColumns || '';
  if (!tracks || tracks === 'none') {
    return 1;
  }
  const count = tracks.trim().split(/\s+/).length;
  return count > 0 ? count : 1;
}

/**
 * Manage roving tabindex for a composite widget (e.g. an artwork card grid).
 *
 * Owns the reactive `activeIndex`, the DOM reads (the cell list + the resolved
 * column count), keyboard handling, and the `tabindex` 0/-1 synchronization.
 * The pure index/intent math lives in `roving-index.js`; this composable only
 * performs DOM reads and `.focus()` calls.
 *
 * Per the W3C APG roving-tabindex practice, exactly one cell holds
 * `tabindex="0"` (the active cell — the single tab stop into the composite) and
 * every other cell holds `tabindex="-1"` (focusable via arrow keys only). When
 * focus enters a cell by click, that cell becomes the active tab stop.
 *
 * @param {() => HTMLElement|null} containerRefFn
 *   Accessor returning the composite's container element (typically a template
 *   ref resolver). Keydown/focusin listeners are attached here; events bubble
 *   up from the focused cell.
 * @param {object} [options]
 * @param {string} [options.cellSelector='.hx-media-card__link-area']
 *   Selector for the focusable cell within each item. Defaults to the card's
 *   navigable link area.
 * @param {() => boolean} [options.enabled]
 *   Predicate controlling whether roving is active. When it returns `false`,
 *   no listeners are attached and any managed `tabindex` attributes are
 *   restored to their implicit (attribute-less) state. Toggling is handled
 *   internally via a watcher.
 * @param {('grid'|'horizontal'|'vertical')} [options.axis='grid']
 *   Navigation axis. `grid` (default) enables all four arrows; `horizontal`
 *   restricts to Left/Right (toolbar/wrapping-row model); `vertical` restricts
 *   to Up/Down. In the 1-D modes, Home/End jump to the first/last cell.
 * @param {() => number} [options.columnCount]
 *   Optional explicit column-count resolver. Defaults to reading the
 *   container's computed `grid-template-columns`.
 * @returns {{
 *   activeIndex: () => number,
 *   onKeydown: (event: KeyboardEvent) => void,
 *   refresh: () => void,
 * }}
 */
export function useRovingTabindex(containerRefFn, options = {}) {
  const cellSelector = options.cellSelector || '.hx-media-card__link-area';
  const isEnabled = typeof options.enabled === 'function' ? options.enabled : () => true;
  // Navigation axis: 'grid' (all four arrows), 'horizontal' (Left/Right only),
  // or 'vertical' (Up/Down only). See resolveRovingIntent for the mapping.
  const axis =
    options.axis === 'horizontal' || options.axis === 'vertical' ? options.axis : 'grid';
  const resolveColumns =
    typeof options.columnCount === 'function'
      ? options.columnCount
      : () => resolveGridColumns(containerRefFn());

  let activeIndex = 0;
  let attached = null;

  function getCells() {
    const el = containerRefFn();
    if (!el || typeof el.querySelectorAll !== 'function') {
      return [];
    }
    return Array.from(el.querySelectorAll(cellSelector));
  }

  function clearManagedTabindex() {
    for (const cell of getCells()) {
      cell.removeAttribute('tabindex');
    }
  }

  function syncTabindex() {
    if (!isEnabled()) {
      return;
    }
    const cells = getCells();
    const total = cells.length;
    if (total === 0) {
      return;
    }
    if (activeIndex > total - 1) {
      activeIndex = 0;
    }
    for (let i = 0; i < total; i++) {
      cells[i].setAttribute('tabindex', i === activeIndex ? '0' : '-1');
    }
  }

  function focusActive() {
    const cells = getCells();
    const el = cells[activeIndex];
    if (el && typeof el.focus === 'function') {
      el.focus();
    }
  }

  function onKeydown(event) {
    if (!isEnabled()) {
      return;
    }
    const intent = resolveRovingIntent({
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      axis,
    });
    if (intent === null) {
      return; // Not a roving key — let the event bubble (e.g. Enter activates the link).
    }
    const cells = getCells();
    const total = cells.length;
    if (total === 0) {
      return;
    }
    // Consume the key so the page does not scroll, even when focus does not move.
    event.preventDefault();
    const next = resolveRovingIndex(activeIndex, intent, resolveColumns(), total);
    if (next == null || next === activeIndex) {
      return;
    }
    activeIndex = next;
    syncTabindex();
    focusActive();
  }

  // When focus enters a cell by click (or programmatic focus), make that cell
  // the roving anchor so the next Tab returns to the grid at the visited card.
  function onFocusin(event) {
    if (!isEnabled()) {
      return;
    }
    const cells = getCells();
    const idx = cells.indexOf(event.target);
    if (idx !== -1 && idx !== activeIndex) {
      activeIndex = idx;
      syncTabindex();
    }
  }

  function refresh() {
    if (isEnabled()) {
      syncTabindex();
    }
  }

  function attach() {
    const el = containerRefFn();
    if (!el) {
      return;
    }
    el.addEventListener('keydown', onKeydown);
    el.addEventListener('focusin', onFocusin);
    attached = el;
    syncTabindex();
  }

  function detach() {
    if (attached) {
      attached.removeEventListener('keydown', onKeydown);
      attached.removeEventListener('focusin', onFocusin);
      attached = null;
    }
  }

  onMounted(() => {
    if (isEnabled()) {
      attach();
    }
  });

  // Self-manage attach/detach when the enabled predicate flips.
  watch(
    () => isEnabled(),
    (enabled) => {
      if (enabled) {
        attach();
      } else {
        detach();
        clearManagedTabindex();
      }
    },
  );

  onBeforeUnmount(() => {
    detach();
  });

  return {
    activeIndex: () => activeIndex,
    onKeydown,
    refresh,
  };
}
