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

import { formatOperationTimestamp } from './operation-run-presentation.js';

export function formatIgnoredUserCountLabel(count) {
  if (!Number.isFinite(count) || count < 1) {
    return 'No ignored source users';
  }

  return `${count} ignored source user${count === 1 ? '' : 's'}`;
}

export function formatSourceUsername(username) {
  return typeof username === 'string' && username.trim() ? username : 'Unknown peer';
}

export function formatIgnoreReason(reason) {
  return typeof reason === 'string' && reason.trim() ? reason : 'No reason recorded';
}

// The ignore store records whether an entry was added manually by an operator or
// automatically by the auto-ignore heuristic; surface that provenance plainly.
export function formatIgnoreSource(source) {
  if (source === 'auto') {
    return 'Auto-applied';
  }
  if (source === 'manual') {
    return 'Operator';
  }
  return typeof source === 'string' && source.trim() ? source : 'Unknown';
}

export function formatIgnoreActor(actorUserId) {
  return typeof actorUserId === 'string' && actorUserId.trim() ? actorUserId : 'System';
}

export function formatIgnoredAt(timestamp) {
  return timestamp ? formatOperationTimestamp(timestamp) : '—';
}

export function formatSuggestionReason(reason) {
  return typeof reason === 'string' && reason.trim() ? reason : 'Repeated low-quality deliveries';
}

// The auto-ignore heuristic attaches a small signal object (sample size,
// failure ratio, success upper bound). Render it as a compact, human-readable
// summary for the operator review row without leaking raw model internals.
export function formatSuggestionSignals(signals) {
  if (!signals || typeof signals !== 'object') {
    return '—';
  }

  const parts = [];
  if (Number.isFinite(signals.sampleSize)) {
    parts.push(`${signals.sampleSize} samples`);
  }
  if (Number.isFinite(signals.decayedFailureRatio)) {
    parts.push(`${Math.round(signals.decayedFailureRatio * 100)}% recent failures`);
  }
  if (Number.isFinite(signals.successUpperBound)) {
    parts.push(`≤${Math.round(signals.successUpperBound * 100)}% success bound`);
  }

  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function filterIgnoredSourceUsers(entries, query) {
  if (!Array.isArray(entries)) {
    return [];
  }

  const normalizedQuery = typeof query === 'string'
    ? query.trim().toLowerCase()
    : '';

  if (!normalizedQuery) {
    return entries;
  }

  return entries.filter((entry) => [
    entry?.username,
    entry?.reason,
    entry?.source,
  ]
    .filter((value) => typeof value === 'string' && value.length > 0)
    .some((value) => value.toLowerCase().includes(normalizedQuery)));
}
