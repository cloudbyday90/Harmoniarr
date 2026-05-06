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
 * Stable colored avatar generation for artists without local or CAA artwork.
 *
 * A deterministic palette index is computed from the artist's MusicBrainz ID
 * using a FNV-1a hash so the same artist always maps to the same color across
 * renders and sessions without any network round-trips.
 */

/**
 * Muted color palette: each entry provides a background and a high-contrast
 * foreground suitable for a single-letter initial.
 */
export const AVATAR_PALETTE = [
  { bg: '#2d3748', fg: '#edf2f7' }, // slate
  { bg: '#1a365d', fg: '#bee3f8' }, // ocean
  { bg: '#1a3d2f', fg: '#c6f6d5' }, // forest
  { bg: '#2d1b69', fg: '#e9d8fd' }, // indigo
  { bg: '#742a2a', fg: '#fed7d7' }, // rust
  { bg: '#134e4a', fg: '#b2f5ea' }, // teal
  { bg: '#3c1361', fg: '#fbb6ce' }, // plum
  { bg: '#744210', fg: '#fefcbf' }, // amber
];

/**
 * Return a palette index for the given MBID using FNV-1a hashing.
 * The result is stable: the same MBID always maps to the same index.
 *
 * @param {string} mbid - MusicBrainz artist ID (or any stable string).
 * @returns {number} Integer in [0, AVATAR_PALETTE.length).
 */
export function getAvatarPaletteIndex(mbid) {
  // FNV-1a 32-bit hash. Unsigned right-shift keeps it in the positive range.
  let hash = 2166136261;
  for (let i = 0; i < mbid.length; i++) {
    hash ^= mbid.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % AVATAR_PALETTE.length;
}

/**
 * Derive a stable colored avatar for an artist.
 *
 * @param {string} mbid  - MusicBrainz artist ID.
 * @param {string} name  - Artist display name used to derive the initial letter.
 * @returns {{ bg: string, fg: string, initial: string }}
 *   `bg` and `fg` are CSS hex color strings. `initial` is the uppercased first
 *   character of the artist name, or '?' when the name is unavailable.
 */
export function getArtistAvatar(mbid, name) {
  const index = getAvatarPaletteIndex(mbid ?? '');
  const { bg, fg } = AVATAR_PALETTE[index];
  const initial = name ? name.trim().charAt(0).toUpperCase() : '?';
  return { bg, fg, initial };
}
