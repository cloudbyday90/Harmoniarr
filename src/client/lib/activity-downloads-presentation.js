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
 * Activity → Downloads screen presentation helpers.
 *
 * Pure functions only — no Vue, no reactive state, no side-effects.
 * All UI string literals live here so they can be tested independently
 * and changed without touching component code.
 *
 * The Soulseek transfer state machine uses PascalCase enum names sourced
 * from the slskd API. These helpers translate them to plain English labels
 * and UI affordances appropriate for a self-hosting admin.
 */

// ── Soulseek transfer state classification ───────────────────────────────────

/**
 * States where a transfer is actively progressing toward completion.
 * Matches slskd TransferStates: InProgress, Queued, Initializing, Negotiating.
 */
const ACTIVE_STATE_RE = /InProgress|Queued|Initializing|Negotiating/i;

/**
 * States where a transfer finished normally without error.
 * "Completed" without any failure qualifier.
 */
const COMPLETED_STATE_RE = /Completed/i;

/**
 * States that indicate any kind of failure or voluntary termination.
 */
const FAILED_STATE_RE = /Errored|Cancelled|Rejected|TimedOut|Aborted/i;

/**
 * Returns true if the slskd transfer state string represents an active
 * (in-flight or queued) transfer.
 *
 * @param {string|null|undefined} state
 * @returns {boolean}
 */
export function isActiveTransferState(state) {
  return typeof state === 'string' && ACTIVE_STATE_RE.test(state);
}

/**
 * Returns true if the slskd transfer state string represents a successfully
 * completed transfer (not errored, cancelled, rejected, or timed out).
 *
 * @param {string|null|undefined} state
 * @returns {boolean}
 */
export function isCompletedTransferState(state) {
  return (
    typeof state === 'string' &&
    COMPLETED_STATE_RE.test(state) &&
    !FAILED_STATE_RE.test(state)
  );
}

/**
 * Returns true if the slskd transfer state string represents a failed,
 * cancelled, rejected, timed-out, or aborted transfer.
 *
 * @param {string|null|undefined} state
 * @returns {boolean}
 */
export function isFailedTransferState(state) {
  return typeof state === 'string' && FAILED_STATE_RE.test(state);
}

// ── State label and tone ─────────────────────────────────────────────────────

/**
 * Map from slskd PascalCase state names to plain English display labels.
 * Only states that need translation are listed; anything else falls back
 * to title-casing the raw value.
 */
const TRANSFER_STATE_LABELS = Object.freeze({
  InProgress: 'Downloading',
  Queued: 'Queued',
  Initializing: 'Starting',
  Negotiating: 'Connecting',
  Completed: 'Completed',
  Errored: 'Failed',
  Cancelled: 'Cancelled',
  Rejected: 'Rejected',
  TimedOut: 'Timed out',
  Aborted: 'Aborted',
  // Compound states slskd sometimes emits (e.g. "Completed, Succeeded")
  'Completed, Succeeded': 'Completed',
  'Completed, Errored': 'Failed',
  'Completed, Cancelled': 'Cancelled',
  'Completed, TimedOut': 'Timed out',
});

/**
 * Returns a plain-English label for a slskd transfer state string.
 * Known compound states (comma-separated) are resolved first.
 * Unknown states are title-cased as a fallback.
 *
 * @param {string|null|undefined} state
 * @returns {string}
 */
export function formatTransferStateLabel(state) {
  if (typeof state !== 'string' || !state) return '—';

  // slskd occasionally returns compound states like "Completed, Succeeded"
  const trimmed = state.trim();
  if (TRANSFER_STATE_LABELS[trimmed] !== undefined) {
    return TRANSFER_STATE_LABELS[trimmed];
  }

  // Try just the first segment for unknown compound states
  const primary = trimmed.split(',')[0]?.trim();
  if (primary && TRANSFER_STATE_LABELS[primary] !== undefined) {
    return TRANSFER_STATE_LABELS[primary];
  }

  // Fallback: insert spaces before uppercase runs and title-case
  return (primary || trimmed)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns a UI tone string for a slskd transfer state, suitable for
 * `data-tone` on a pill component.
 *
 * - active states → 'warning' (in-progress but not done)
 * - completed states → 'success'
 * - failed states → 'danger'
 * - unknown → 'info'
 *
 * @param {string|null|undefined} state
 * @returns {'warning'|'success'|'danger'|'info'}
 */
export function formatTransferStateTone(state) {
  if (isFailedTransferState(state)) return 'danger';
  if (isCompletedTransferState(state)) return 'success';
  if (isActiveTransferState(state)) return 'warning';
  return 'info';
}

// ── File transfer metrics ────────────────────────────────────────────────────

/**
 * Calculates the transfer progress as an integer percentage (0–100), or
 * returns null when the data is unavailable or not meaningful.
 *
 * Returns null if:
 * - size is missing, zero, or non-finite
 * - bytesTransferred is missing or non-finite
 * Returns 0 if bytesTransferred is negative (guard against bad data).
 *
 * @param {{ size?: number|null, bytesTransferred?: number|null }} file
 * @returns {number|null}
 */
export function calculateTransferProgress(file) {
  const size = Number(file?.size);
  const transferred = Number(file?.bytesTransferred);
  if (!Number.isFinite(size) || size <= 0) return null;
  if (!Number.isFinite(transferred) || transferred < 0) return 0;
  return Math.min(100, Math.round((transferred / size) * 100));
}

// ── File path ────────────────────────────────────────────────────────────────

/**
 * Returns the filename component of a full file path, stripping any
 * leading directory segments. Works with both forward-slash and
 * backslash separators.
 * Returns '—' for non-string input.
 *
 * @param {string|null|undefined} filePath
 * @returns {string}
 */
export function formatTransferFilename(filePath) {
  if (typeof filePath !== 'string') return '—';
  const i = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  const name = i >= 0 ? filePath.slice(i + 1) : filePath;
  return name || '—';
}

// ── Summary counts ───────────────────────────────────────────────────────────

/**
 * Returns a plain-English activity summary string for the download screen
 * subtitle, e.g. "3 active · 12 complete · 0 failed".
 *
 * @param {{ active: number, completed: number, failed: number }} counts
 * @returns {string}
 */
export function formatDownloadActivitySummary({ active, completed, failed }) {
  return `${active} active · ${completed} complete · ${failed} failed`;
}
