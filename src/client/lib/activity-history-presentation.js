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
 * Activity → History screen presentation helpers.
 *
 * Pure functions only — no Vue, no reactive state, no side-effects.
 * All UI string literals live here so they can be tested independently
 * and changed without touching component code.
 */

// ── Activity entry type labels ───────────────────────────────────────────────

/**
 * Known entry type → plain English label mappings.
 * Keys are the raw snake_case strings the backend emits.
 * Values are sentence-case phrases suitable for display to an admin.
 */
const ENTRY_TYPE_LABELS = Object.freeze({
  library_scan_started: 'Library scan started',
  library_scan_completed: 'Library scan completed',
  library_scan_failed: 'Library scan failed',
  metadata_refresh_started: 'Metadata refresh started',
  metadata_refresh_completed: 'Metadata refresh completed',
  metadata_refresh_queued: 'Metadata refresh queued',
  metadata_refresh_failed: 'Metadata refresh failed',
  import_executed: 'Import executed',
  import_completed: 'Import completed',
  import_failed: 'Import failed',
  wanted_reconciliation_started: 'Wanted reconciliation started',
  wanted_reconciliation_completed: 'Wanted reconciliation completed',
  wanted_reconciliation_failed: 'Wanted reconciliation failed',
  download_started: 'Download started',
  download_completed: 'Download completed',
  download_failed: 'Download failed',
  user_login: 'User sign-in',
  user_logout: 'User sign-out',
  settings_changed: 'Settings changed',
  system_startup: 'System started',
  system_shutdown: 'System stopped',
});

/**
 * Returns a plain-English label for an activity entry type string.
 * Known snake_case types are resolved via a lookup table. Unknown types
 * are converted by replacing underscores with spaces and title-casing
 * each word, so new types remain readable without a code change.
 *
 * Returns '—' for falsy input.
 *
 * @param {string|null|undefined} entryType
 * @returns {string}
 */
export function formatActivityEntryTypeLabel(entryType) {
  if (typeof entryType !== 'string' || !entryType) return '—';

  if (ENTRY_TYPE_LABELS[entryType] !== undefined) {
    return ENTRY_TYPE_LABELS[entryType];
  }

  // Fallback: snake_case / mixed → Title Case (each word capitalised)
  return entryType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Activity entry status ────────────────────────────────────────────────────

/**
 * Map from raw backend status strings to plain-English display labels.
 */
const STATUS_LABELS = Object.freeze({
  success: 'Succeeded',
  completed: 'Succeeded',
  ok: 'Succeeded',
  failed: 'Failed',
  error: 'Failed',
  cancelled: 'Cancelled',
  in_progress: 'In progress',
  pending: 'Pending',
  skipped: 'Skipped',
  warning: 'Warning',
});

/**
 * Returns a plain-English label for an activity entry status string.
 * Unknown statuses are title-cased as a fallback (replacing underscores).
 * Returns '—' for falsy input.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function formatActivityEntryStatusLabel(status) {
  if (typeof status !== 'string' || !status) return '—';

  if (STATUS_LABELS[status] !== undefined) {
    return STATUS_LABELS[status];
  }

  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns a UI tone string for an activity entry status, suitable for
 * `data-tone` on a pill component.
 *
 * - success/completed/ok → 'success'
 * - failed/error/cancelled → 'danger'
 * - in_progress/pending → 'warning'
 * - warning → 'warning'
 * - skipped/unknown → 'info'
 *
 * @param {string|null|undefined} status
 * @returns {'success'|'danger'|'warning'|'info'}
 */
export function formatActivityEntryStatusTone(status) {
  if (status === 'success' || status === 'completed' || status === 'ok') return 'success';
  if (status === 'failed' || status === 'error' || status === 'cancelled') return 'danger';
  if (status === 'in_progress' || status === 'pending' || status === 'warning') return 'warning';
  return 'info';
}

// ── Count label ──────────────────────────────────────────────────────────────

/**
 * Returns a correctly pluralised entry count label for use in the subtitle,
 * e.g. "1 entry" or "42 entries".
 *
 * @param {number} count
 * @returns {string}
 */
export function formatActivityEntryCountLabel(count) {
  return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}
