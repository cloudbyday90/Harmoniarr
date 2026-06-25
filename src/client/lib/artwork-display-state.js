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
 * Pure artwork display-state resolver.
 *
 * Discovers the correct artwork presentation for a card from two value-level
 * inputs: whether a resolved artwork URL exists, and whether artwork resolution
 * is currently in progress. Isolating this into a DOM-free function lets the
 * card's three render branches (`image` / `loading` / `initial`) be driven by
 * one unit-tested decision instead of ad-hoc template conditions.
 *
 * The `isResolving` flag is the global batch-resolution flag from
 * `useDiscoverArtistArtwork`; a card shows the skeleton only when it has no URL
 * *and* a batch is in flight. Once resolution completes, a URL-less card settles
 * on the `initial` fallback (avatar) rather than a perpetual skeleton.
 *
 * @typedef {('image'|'loading'|'initial')} ArtworkDisplayState
 */

/**
 * Resolve the artwork display state for a card.
 *
 * @param {object} [descriptor]
 * @param {string|null|undefined} [descriptor.url]
 *   The resolved artwork URL. A non-empty string yields `image`.
 * @param {boolean} [descriptor.isResolving]
 *   Whether artwork resolution is in progress. Strict boolean — only literal
 *   `true` counts (no truthy coercion), so a stale/unknown flag cannot trigger
 *   a perpetual skeleton.
 * @returns {ArtworkDisplayState} `'image'` | `'loading'` | `'initial'`.
 */
export function resolveArtworkDisplayState({ url, isResolving } = {}) {
  if (typeof url === 'string' && url.length > 0) {
    return 'image';
  }
  if (isResolving === true) {
    return 'loading';
  }
  return 'initial';
}
