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

export function formatBlockedUserCountLabel(count) {
  if (!Number.isFinite(count) || count < 1) {
    return 'No blocked source users';
  }

  return `${count} blocked source user${count === 1 ? '' : 's'}`;
}

export function formatSourceUsername(username) {
  return typeof username === 'string' && username.trim() ? username : 'Unknown peer';
}

export function formatBlockReason(reason) {
  return typeof reason === 'string' && reason.trim() ? reason : 'No reason recorded';
}

export function formatOperatorNotes(notes) {
  return typeof notes === 'string' && notes.trim() ? notes : '—';
}

export function formatBlockedByUser(userId) {
  return typeof userId === 'string' && userId.trim() ? userId : 'System';
}

export function formatBlockedAt(timestamp) {
  return timestamp ? formatOperationTimestamp(timestamp) : '—';
}

export function filterBlockedSourceUsers(entries, query) {
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
    entry?.blockReason,
    entry?.operatorNotes,
  ]
    .filter((value) => typeof value === 'string' && value.length > 0)
    .some((value) => value.toLowerCase().includes(normalizedQuery)));
}
