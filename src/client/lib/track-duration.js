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
 * Format a track duration given in milliseconds as m:ss.
 *
 * Returns null for missing, zero, or negative values — callers should supply
 * their own fallback (e.g. `formatTrackDuration(ms) ?? ''` or `?? 'Unknown'`).
 *
 * @param {number|null|undefined} ms
 * @returns {string|null}
 */
export function formatTrackDuration(ms) {
  if (!ms || ms <= 0) return null;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format a file duration given in seconds as m:ss.
 *
 * Used when the data source stores length in seconds (e.g. import candidate
 * file metadata) rather than milliseconds.
 *
 * Returns null for missing, zero, or negative values.
 *
 * @param {number|null|undefined} seconds
 * @returns {string|null}
 */
export function formatFileDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const totalSec = Math.round(seconds);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Sum the total playback duration in milliseconds across a MusicBrainz-style
 * media array (each medium has a `tracks` array with optional `lengthMs`
 * fields).
 *
 * Safely handles null/undefined input and missing track fields.
 *
 * @param {Array|null|undefined} mediaArray
 * @returns {number}
 */
export function computeMediaTotalMs(mediaArray) {
  let total = 0;
  for (const medium of mediaArray ?? []) {
    for (const track of medium.tracks ?? []) {
      if (track.lengthMs) total += track.lengthMs;
    }
  }
  return total;
}

/**
 * Format a total album or disc runtime in milliseconds as h:mm:ss (when
 * one or more hours are present) or m:ss.
 *
 * Returns null for zero or negative totals.
 *
 * @param {number|null|undefined} totalMs
 * @returns {string|null}
 */
export function formatAlbumRuntime(totalMs) {
  if (!totalMs || totalMs <= 0) return null;
  const totalSec = Math.round(totalMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
