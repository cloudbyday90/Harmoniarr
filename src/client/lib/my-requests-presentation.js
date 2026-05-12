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
 * Pure presentational helpers for the My Requests view.
 *
 * All functions are side-effect-free and testable in isolation under Node.
 */

/**
 * Returns a new sorted copy of the given requests array.
 *
 * Supported field values:
 *   - 'title'        — sorts by releaseGroupTitle, falling back to title
 *   - 'artist'       — sorts by artistSortName, falling back to artistName
 *   - 'requested_at' — sorts by requestedAt, falling back to createdAt (default)
 *
 * @param {Array<object>} requests
 * @param {{ field?: string, order?: 'asc' | 'desc' }} [options]
 * @returns {Array<object>}
 */
export function sortMyRequests(requests, { field = 'requested_at', order = 'desc' } = {}) {
  return [...requests].sort((a, b) => {
    let av, bv;
    if (field === 'title') {
      av = (a.releaseGroupTitle ?? a.title ?? '').toLowerCase();
      bv = (b.releaseGroupTitle ?? b.title ?? '').toLowerCase();
    } else if (field === 'artist') {
      av = (a.artistSortName ?? a.artistName ?? '').toLowerCase();
      bv = (b.artistSortName ?? b.artistName ?? '').toLowerCase();
    } else {
      av = a.requestedAt ?? a.createdAt ?? '';
      bv = b.requestedAt ?? b.createdAt ?? '';
    }
    if (av < bv) return order === 'asc' ? -1 : 1;
    if (av > bv) return order === 'asc' ? 1 : -1;
    return 0;
  });
}
