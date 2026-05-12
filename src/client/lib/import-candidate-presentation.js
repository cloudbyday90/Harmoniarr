/*
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Format an ISO timestamp for display. Returns `fallback` when the value is
 * absent or unparseable.
 *
 * @param {string|null|undefined} value
 * @param {string} [fallback='Unknown']
 * @returns {string}
 */
export function formatTimestamp(value, fallback = 'Unknown') {
  if (!value) {
    return fallback;
  }

  const ts = new Date(value);
  return Number.isNaN(ts.getTime()) ? value : ts.toLocaleString();
}

/**
 * Format a byte count as a human-readable size string.
 * Returns 'Unknown size' for absent, NaN, or non-positive values.
 *
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function formatBytes(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return 'Unknown size';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Return a filesystem path for display. Falls back to 'Unavailable' for
 * absent or empty values.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function formatPath(value) {
  return value || 'Unavailable';
}

/**
 * Convert an underscore- or hyphen-delimited token (e.g. 'download_enqueue')
 * into a space-separated label. Returns 'unknown' for absent values.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function formatTokenLabel(value) {
  return String(value || 'unknown').replaceAll(/[_-]+/g, ' ');
}

/**
 * Return a display label for a candidate status code.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function candidateStatusLabel(status) {
  switch (status) {
    case 'held':
      return 'Held';
    case 'rejected':
      return 'Rejected';
    case 'selected':
      return 'Selected';
    case 'downloading':
      return 'Downloading';
    case 'import_pending':
      return 'Import pending';
    case 'applied':
      return 'Applied';
    case 'failed':
      return 'Failed';
    default:
      return 'Pending';
  }
}

/**
 * Return a display label for a run status code (execution or apply runs).
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function formatRunStatus(status) {
  switch (status) {
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'completed':
      return 'Completed';
    default:
      return 'Pending';
  }
}

/**
 * Return a display label for an execution mode code.
 *
 * @param {string|null|undefined} mode
 * @returns {string}
 */
export function formatExecutionMode(mode) {
  switch (mode) {
    case 'download_enqueue':
      return 'Queue downloads';
    default:
      return mode || 'Download';
  }
}

/**
 * Format a percentage value for display. Returns 'Unavailable' for
 * non-finite values.
 *
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function formatPercent(value) {
  return Number.isFinite(value) ? `${value}%` : 'Unavailable';
}

/**
 * Returns a UI tone string for an import candidate status, suitable for the
 * `data-tone` attribute on a pill component.
 *
 * - applied            → 'success'
 * - failed / rejected  → 'danger'
 * - downloading        → 'warning'
 * - held / import_pending / selected → 'info'
 * - unknown            → undefined
 *
 * @param {string|null|undefined} status
 * @returns {'success'|'danger'|'warning'|'info'|undefined}
 */
export function candidateStatusTone(status) {
  if (status === 'applied') return 'success';
  if (status === 'failed' || status === 'rejected') return 'danger';
  if (status === 'downloading') return 'warning';
  if (status === 'held' || status === 'import_pending' || status === 'selected') return 'info';
  return undefined;
}

/**
 * Returns a human-readable label for an import candidate source provider
 * token. Hides internal provider identifiers from the UI.
 *
 * - slskd       → 'Soulseek'
 * - musicbrainz → 'MusicBrainz'
 * - unknown/null → '—'
 *
 * @param {string|null|undefined} provider
 * @returns {string}
 */
export function formatSourceProvider(provider) {
  if (!provider || typeof provider !== 'string') return '\u2014';
  switch (provider.toLowerCase()) {
    case 'slskd': return 'Soulseek';
    case 'musicbrainz': return 'MusicBrainz';
    case 'spotify': return 'Spotify';
    case 'youtube': return 'YouTube';
    case 'apple_music': return 'Apple Music';
    default: return provider.charAt(0).toUpperCase() + provider.slice(1).replace(/_/g, ' ');
  }
}

/**
 * Returns a human-readable count label for the number of import candidates,
 * e.g. "1 candidate" or "4 candidates".
 *
 * @param {number} count
 * @returns {string}
 */
export function formatCandidateCountLabel(count) {
  return count === 1 ? '1 candidate' : `${count} candidates`;
}
