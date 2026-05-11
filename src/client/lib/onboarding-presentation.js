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
 * Pure presentation helpers for the OnboardingSummaryPanel component.
 * All functions are side-effect-free and depend only on their arguments.
 */

/**
 * Matches the leading portion of an ISO 8601 datetime string, e.g. "2026-05-11T15:41:42.139Z".
 * Used to detect timestamp values in step metadata so they can be formatted for display.
 */
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/**
 * Convert a camelCase or PascalCase metadata key into a human-readable label.
 *
 * @param {string} key
 * @returns {string}
 */
export function formatMetaLabel(key) {
  if (!key) return '';
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Format a metadata value for display.
 * Booleans become "Yes" / "No".
 * Null, undefined, and empty strings become "Unavailable".
 * ISO 8601 datetime strings are formatted as locale-aware short datetime strings.
 * All other values are coerced to string.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function formatMetaValue(value) {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (value == null || value === '') {
    return 'Unavailable';
  }

  if (typeof value === 'string' && ISO_DATETIME_RE.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  return String(value);
}

/**
 * Return the display label for a setup-step status value.
 *
 * @param {string|undefined} status
 * @returns {string}
 */
export function getStepStatusLabel(status) {
  switch (status) {
    case 'complete': return 'Complete';
    case 'info': return 'Info';
    default: return 'Needs attention';
  }
}

/**
 * Return the CSS class name for a setup-step status pill.
 *
 * @param {string|undefined} status
 * @returns {string}
 */
export function getStepStatusClass(status) {
  switch (status) {
    case 'complete': return 'review-status-selected';
    case 'info': return 'review-status-pending';
    default: return 'review-status-held';
  }
}
