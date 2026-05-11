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
 * Formats a UTC/ISO timestamp string into a locale-appropriate string for
 * display. Returns a fallback label for empty or unparseable values.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function formatTimestamp(value) {
  if (!value) return 'Not yet recorded';
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? String(value) : timestamp.toLocaleString();
}

/**
 * Formats a byte count as a human-readable string with appropriate unit
 * (B, KB, MB, GB), rounded to one decimal place for sub-10 values.
 *
 * @param {number | null | undefined} value
 * @returns {string}
 */
export function formatBytes(value) {
  if (!Number.isFinite(value) || value < 1) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let nextValue = value;
  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }
  return `${nextValue.toFixed(nextValue >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Converts an internal scope or camelCase/snake_case identifier into a
 * title-cased display label.
 *
 * @param {string | null | undefined} scope
 * @returns {string}
 */
export function formatScope(scope) {
  if (typeof scope !== 'string' || scope.length === 0) return 'Unknown';
  return scope
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns the CSS class name for a compatibility check status pill.
 *
 * @param {string | null | undefined} status
 * @returns {string}
 */
export function checkStatusClass(status) {
  return status === 'passed' ? 'review-status-selected' : 'review-status-failed';
}

/**
 * Returns the display label for a compatibility check status.
 *
 * @param {string | null | undefined} status
 * @returns {string}
 */
export function checkStatusLabel(status) {
  return status === 'passed' ? 'Passed' : 'Failed';
}

/**
 * Returns a plain-language description of whether a backup can be restored.
 * Uses operator-friendly language — no reference to internal lock concepts.
 *
 * @param {{ canApplyRestore?: boolean, restoreReadiness?: { blockedByLock?: boolean } } | null | undefined} preview
 * @returns {string}
 */
export function describeRestoreReadiness(preview) {
  if (!preview) return 'Select a backup to check whether it is safe to restore.';
  if (preview.canApplyRestore) return 'This backup passed all checks and can be applied.';
  if (preview.restoreReadiness?.blockedByLock) {
    return 'The app is currently busy with another task. Click \u2018Refresh checks\u2019 in a moment to see if it\u2019s ready.';
  }
  return 'Review the failed checks below before applying this backup.';
}
