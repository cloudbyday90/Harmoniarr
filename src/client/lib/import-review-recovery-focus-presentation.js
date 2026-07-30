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

function hasRouteValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

const statusFocusLabels = Object.freeze({
  applied: 'Review library result',
  downloading: 'Review download progress',
  failed: 'Resolve a failed match',
  held: 'Review a paused match',
  import_pending: 'Review library add',
  rejected: 'Review a rejected match',
  selected: 'Review selected matches',
});

export function buildImportReviewRecoveryFocus(routeState = {}) {
  if (hasRouteValue(routeState.candidateFileId)) {
    return 'Fix a file issue';
  }

  if (routeState.status === 'import_pending') {
    return statusFocusLabels.import_pending;
  }

  if (hasRouteValue(routeState.candidateId)) {
    return 'Review selected match';
  }

  return statusFocusLabels[routeState.status] ?? 'Resolve a match issue';
}
