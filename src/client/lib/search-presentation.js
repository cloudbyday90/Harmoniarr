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
 * Search-screen presentation helpers.
 *
 * Pure functions only — no Vue, no reactive state, no side-effects.
 * All string literals that appear in the UI live here so they can be
 * tested independently and changed without touching component code.
 */

// ── Music search ─────────────────────────────────────────────────────────────

const MUSIC_SEARCH_GENERIC = 'Search failed. Check your connection and try again.';
const MUSIC_SEARCH_UNAVAILABLE = 'Search is temporarily unavailable. Try again in a moment.';

/**
 * Normalise a raw music-search error for display.
 *
 * - null/undefined/empty → generic fallback
 * - MusicBrainz service errors → service-agnostic unavailability message
 * - API parameter validation errors → generic fallback (suppress technical detail)
 * - Unknown messages → pass through unchanged
 *
 * @param {string|null|undefined} rawError
 * @returns {string}
 */
export function formatMusicSearchError(rawError) {
  if (!rawError) return MUSIC_SEARCH_GENERIC;
  const lower = rawError.toLowerCase();
  if (lower.includes('musicbrainz')) return MUSIC_SEARCH_UNAVAILABLE;
  if (lower.includes('must be') || lower.includes('invalid') || lower.includes('bad request')) {
    return MUSIC_SEARCH_GENERIC;
  }
  return rawError;
}

// ── Network search errors ────────────────────────────────────────────────────

const NETWORK_SEARCH_GENERIC = 'Search failed. Try again.';
const NETWORK_SEARCH_START_FAILED = 'Search could not be started. Try again.';
const NETWORK_SEARCH_POLL_FAILED = 'Could not retrieve results. Try again.';

/**
 * Normalise a raw network-search error for display.
 *
 * Strips internal service names (slskd) and maps known error messages to
 * user-readable copy. Unknown messages are passed through unchanged.
 *
 * @param {string|null|undefined} rawError
 * @returns {string}
 */
export function formatNetworkSearchError(rawError) {
  if (!rawError) return NETWORK_SEARCH_GENERIC;
  const lower = rawError.toLowerCase();
  // Suppress internal service name
  if (lower.includes('slskd')) return NETWORK_SEARCH_START_FAILED;
  if (lower.includes('poll') || lower.includes('polling')) return NETWORK_SEARCH_POLL_FAILED;
  if (lower.includes('failed to start') || lower.includes('could not start')) {
    return NETWORK_SEARCH_START_FAILED;
  }
  return rawError;
}

// ── Network connection status ─────────────────────────────────────────────────

/**
 * Map a slskd status object to a UI tone (success / warning / danger / info).
 *
 * @param {object|null|undefined} statusObj - The raw slskd status object.
 * @returns {'success'|'warning'|'danger'|'info'}
 */
export function buildNetworkStatusTone(statusObj) {
  const state = statusObj?.state ?? statusObj?.connectionState;
  if (state === 'connected' || state === 'ready' || state === 'online') return 'success';
  if (state === 'connecting' || state === 'reconnecting') return 'warning';
  if (!state) return 'info';
  return 'danger';
}

/**
 * Map a slskd status object to a display label.
 *
 * @param {object|null|undefined} statusObj - The raw slskd status object.
 * @param {boolean} isProbing - True while the status is being fetched.
 * @returns {string}
 */
export function buildNetworkStatusLabel(statusObj, isProbing) {
  if (isProbing && !statusObj) return 'Checking connection…';
  const state = statusObj?.state ?? statusObj?.connectionState;
  if (!state) return 'Status unknown';
  return state.charAt(0).toUpperCase() + state.slice(1);
}

// ── Network search state ──────────────────────────────────────────────────────

/** Internal → display label map for slskd search state values. */
const SEARCH_STATE_LABELS = {
  inprogress: 'Searching',
  completed: 'Complete',
  cancelled: 'Stopped',
  timedout: 'Timed out',
};

/**
 * Map a raw slskd search state value to a human-readable label.
 *
 * @param {string|null|undefined} state
 * @returns {string}
 */
export function buildNetworkSearchStateLabel(state) {
  if (!state) return '';
  const mapped = SEARCH_STATE_LABELS[state.toLowerCase()];
  if (mapped) return mapped;
  // Fallback: capitalise first character
  return state.charAt(0).toUpperCase() + state.slice(1);
}

// ── Empty / pre-search copy ───────────────────────────────────────────────────

/**
 * Body copy for the Music tab pre-search empty state.
 * Must not use operator language ("monitor") — requesters "follow" artists.
 *
 * @returns {string}
 */
export function buildSearchPreSearchBody() {
  return 'Find artists to follow or releases to request.';
}

/**
 * Body copy shown when a network search has no results yet.
 * Must not reference "Soulseek" or "peers" as implementation details.
 *
 * @returns {string}
 */
export function buildNetworkNoResultsBody() {
  return 'Enter a query and press Search. Results appear as peers respond with matching files.';
}

// ── Byte / speed formatting ───────────────────────────────────────────────────

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/**
 * Format a byte count as a human-readable string (e.g. "4.2 MB").
 * Returns '—' for invalid or non-positive inputs.
 *
 * @param {number|null|undefined} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || bytes <= 0) return '—';
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < BYTE_UNITS.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${BYTE_UNITS[i]}`;
}

/**
 * Format a bytes-per-second value as a human-readable speed string.
 * Returns '—' for invalid or non-positive inputs.
 *
 * @param {number|null|undefined} bytesPerSec
 * @returns {string}
 */
export function formatSpeed(bytesPerSec) {
  if (typeof bytesPerSec !== 'number' || bytesPerSec <= 0) return '—';
  return `${formatBytes(bytesPerSec)}/s`;
}

// ── Response normalisation ────────────────────────────────────────────────────

/**
 * Return the total file size for a slskd search response object.
 * Prefers the top-level `totalSize` field; falls back to summing `files[].size`.
 *
 * @param {object} response
 * @returns {number}
 */
export function totalSizeForResponse(response) {
  if (typeof response?.totalSize === 'number') return response.totalSize;
  if (Array.isArray(response?.files)) {
    let sum = 0;
    for (const file of response.files) sum += file.size ?? 0;
    return sum;
  }
  return 0;
}

// ── Response sorting / filtering ──────────────────────────────────────────────

/**
 * Return the file count for a slskd search response object.
 * Prefers the top-level `fileCount` field; falls back to the length of
 * the `files` array; returns 0 when neither is available.
 *
 * @param {object} response
 * @returns {number}
 */
function responseFileCount(response) {
  if (typeof response?.fileCount === 'number') return response.fileCount;
  if (Array.isArray(response?.files)) return response.files.length;
  return 0;
}

/**
 * Filter and sort an array of slskd search response objects for display.
 *
 * Filtering:
 *   - Responses with fewer files than `minimumFileCount` are excluded.
 *
 * Sorting (descending priority):
 *   1. Upload speed descending (faster peers first).
 *   2. Queue length ascending (shorter queues first) as tiebreaker.
 *
 * @param {object[]} responses
 * @param {{ minimumFileCount?: number }} [options]
 * @returns {object[]}
 */
export function sortNetworkResponses(responses, { minimumFileCount = 1 } = {}) {
  const minFiles = Number(minimumFileCount) || 1;
  return [...responses]
    .filter((r) => responseFileCount(r) >= minFiles)
    .sort((a, b) => {
      const speedDelta = (b.uploadSpeed ?? 0) - (a.uploadSpeed ?? 0);
      if (speedDelta !== 0) return speedDelta;
      return (a.queueLength ?? 0) - (b.queueLength ?? 0);
    });
}

// ── Count labels ──────────────────────────────────────────────────────────────

/**
 * Format a peer count as a display label ("1 peer" / "N peers").
 *
 * @param {number} count
 * @returns {string}
 */
export function formatPeerCountLabel(count) {
  return count === 1 ? '1 peer' : `${count} peers`;
}

/**
 * Format a file count as a display label ("1 file" / "N files").
 *
 * @param {number} count
 * @returns {string}
 */
export function formatFileCountLabel(count) {
  return count === 1 ? '1 file' : `${count} files`;
}
