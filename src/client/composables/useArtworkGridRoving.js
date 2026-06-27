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

import { isRef, nextTick, watch } from 'vue';
import { useRovingTabindex } from './useRovingTabindex.js';

/**
 * Roving tabindex for an `.hx-artwork-grid` card list.
 *
 * Thin convenience wrapper around `useRovingTabindex` that bakes in the
 * 2-D `grid` axis and re-syncs the managed `tabindex` whenever the card count
 * changes (search results, library data, paging, etc.), so each view does not
 * repeat the watch boilerplate. The pure index/intent math and DOM listener
 * wiring live in `useRovingTabindex` / `roving-index.js`.
 *
 * Each card exposes a focusable "link area" (ArtistCard/ReleaseCard:
 * `.hx-media-card__link-area`; RequestCard: `.request-card`). For grids with a
 * trailing non-card link (e.g. a "discover more" `RouterLink`), pass a union
 * `cellSelector`.
 *
 * Inactive card action controls are removed from the Tab sequence while the
 * active card's controls keep native focusability. This keeps the grid's active
 * card as the Tab entry point without making per-card actions unreachable.
 *
 * @param {() => HTMLElement|null} containerRefFn - Accessor for the `<ul>` grid.
 * @param {object} options
 * @param {string} options.cellSelector - Selector for the focusable cell(s).
 * @param {string} [options.managedControlSelector] - Optional selector for
 *   secondary controls scoped to the same `<li>` item as each roving cell.
 * @param {import('vue').Ref<number>|(() => number)} [options.count]
 *   Ref/computed ref or getter for the live card count; when it changes, the
 *   managed `tabindex` is re-applied on `nextTick`.
 * @returns {{ refresh: () => void }}
 */
export function useArtworkGridRoving(containerRefFn, options = {}) {
  const { refresh } = useRovingTabindex(containerRefFn, {
    cellSelector: options.cellSelector,
    managedControlSelector: options.managedControlSelector
      ?? '.hx-media-card__actions :is(a[href], button, input, select, textarea, [tabindex])',
    axis: 'grid',
  });

  if (typeof options.count === 'function' || isRef(options.count)) {
    watch(options.count, () => {
      nextTick(refresh);
    }, { immediate: true });
  }

  return { refresh };
}
