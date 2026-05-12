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

export function getActivityFeedStatusClass(status) {
  switch (status) {
    case 'success':
      return 'review-status-selected';
    case 'error':
      return 'review-status-failed';
    case 'active':
      return 'review-status-held';
    default:
      return '';
  }
}

export function getActivityFeedStatusLabel(status) {
  switch (status) {
    case 'success':
      return 'Completed';
    case 'error':
      return 'Attention';
    case 'active':
      return 'Active';
    default:
      return 'Recorded';
  }
}

/**
 * Format an activity feed entry type token for display.
 *
 * Converts all underscore- or hyphen-separated parts to spaces so that raw
 * API values like 'library_scan_completed' become 'library scan completed'.
 * Returns 'unknown' for absent values.
 *
 * @param {string|null|undefined} entryType
 * @returns {string}
 */
export function formatActivityFeedEntryTypeLabel(entryType) {
  return String(entryType || 'unknown').replaceAll(/[_-]+/g, ' ');
}
