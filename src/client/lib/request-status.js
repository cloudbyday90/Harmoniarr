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
 * Maps backend request_state values to requester-friendly display labels.
 *
 * Backend status values (from media_requests.request_state CHECK constraint):
 *   needs_fetch   — request is queued and awaiting processing
 *   needs_review  — request needs manual operator review
 *   already_exists — the requested release is already in the library
 *
 * @type {Record<string, { label: string, variant: string }>}
 */
const STATUS_MAP = {
  needs_fetch:    { label: 'Searching',       variant: 'info'    },
  needs_review:   { label: 'Under Review',    variant: 'warning' },
  already_exists: { label: 'In Library',      variant: 'success' },
  // Tolerant mappings for any future status values that may be added server-side.
  pending:        { label: 'Pending',         variant: 'neutral' },
  queued:         { label: 'Queued',          variant: 'neutral' },
  searching:      { label: 'Searching',       variant: 'info'    },
  downloading:    { label: 'Downloading',     variant: 'info'    },
  fulfilled:      { label: 'Fulfilled',       variant: 'success' },
  completed:      { label: 'Fulfilled',       variant: 'success' },
  failed:         { label: 'Failed',          variant: 'danger'  },
  cancelled:      { label: 'Cancelled',       variant: 'muted'   },
};

const UNKNOWN = { label: 'Unknown', variant: 'muted' };

/**
 * Normalize a raw status string for lookup: lowercase and trim whitespace.
 *
 * @param {*} status - Raw status value from the API.
 * @returns {string} Normalized status key.
 */
export function normalizeRequestStatus(status) {
  if (typeof status !== 'string') return '';
  return status.trim().toLowerCase();
}

/**
 * Return the requester-friendly display label for a request status.
 *
 * @param {*} status - Raw backend status string.
 * @returns {string}
 */
export function getRequestStatusLabel(status) {
  return (STATUS_MAP[normalizeRequestStatus(status)] ?? UNKNOWN).label;
}

/**
 * Return the visual variant identifier for a request status.
 * Variants: 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'muted'
 *
 * @param {*} status - Raw backend status string.
 * @returns {string}
 */
export function getRequestStatusVariant(status) {
  return (STATUS_MAP[normalizeRequestStatus(status)] ?? UNKNOWN).variant;
}
