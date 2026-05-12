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

/**
 * Format an ISO date string into a locale-appropriate short date (year, month,
 * day). Returns `null` for missing or unparseable values.
 *
 * @param {string|null|undefined} isoString
 * @returns {string|null}
 */
export function formatRequestDate(isoString) {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return null;
  }
}

/**
 * Return a display label for a request kind token, or `null` when the kind
 * is absent or not worth surfacing.
 *
 * @param {string|null|undefined} requestKind
 * @returns {string|null}
 */
export function getRequestKindLabel(requestKind) {
  if (requestKind === 'external_url') return 'External URL';
  if (requestKind === 'track') return 'Track';
  if (requestKind === 'release') return 'Release';
  return null;
}

/**
 * Build an attribution line that identifies the submitter and/or beneficiary
 * of a delegated request, relative to the current viewer.
 *
 * Returns `null` when:
 * - `viewerUserId` is absent (attribution suppressed)
 * - `requestedByUser` or `requestedForUser` is missing
 * - The submitter and beneficiary are the same person (not a delegation)
 *
 * Cases:
 * - Viewer is the beneficiary → `"Requested by <submitter>"`
 * - Viewer is the submitter   → `"For <beneficiary>"`
 * - Neither                   → `"By <submitter> · For <beneficiary>"`
 *
 * @param {object} request  — API request object
 * @param {string|null} viewerUserId
 * @returns {string|null}
 */
export function getRequestAttributionLine(request, viewerUserId) {
  if (!viewerUserId) return null;

  const by = request?.requestedByUser;
  const forUser = request?.requestedForUser;

  if (!by?.id || !forUser?.id) return null;
  if (by.id === forUser.id) return null;

  const byName = by.username ?? 'Unknown';
  const forName = forUser.username ?? 'Unknown';

  if (viewerUserId === forUser.id) {
    return `Requested by ${byName}`;
  }

  if (viewerUserId === by.id) {
    return `For ${forName}`;
  }

  return `By ${byName} · For ${forName}`;
}
