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

const ALLOWED_STATES = new Set(['needs_fetch', 'needs_review', 'already_exists', 'cancelled', 'failed']);
const ALLOWED_KINDS = new Set(['release', 'track', 'external_url']);
const ALLOWED_SORTS = new Set(['newest', 'oldest', 'state', 'kind']);

function normalizeRouteValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeToken(value, allowed) {
  const normalized = normalizeRouteValue(value);
  return allowed.has(normalized) ? normalized : '';
}

export function normalizeRequestListRouteState(query = {}) {
  return {
    requestKind: normalizeToken(query.requestKind, ALLOWED_KINDS),
    requestState: normalizeToken(query.requestState, ALLOWED_STATES),
    search: normalizeRouteValue(query.search),
    sortBy: normalizeToken(query.sortBy, ALLOWED_SORTS),
  };
}

export function buildRequestListRouteQuery(state = {}) {
  const requestKind = normalizeToken(state.requestKind, ALLOWED_KINDS);
  const requestState = normalizeToken(state.requestState, ALLOWED_STATES);
  const search = normalizeRouteValue(state.search);
  const sortBy = normalizeToken(state.sortBy, ALLOWED_SORTS);
  const query = {};

  if (requestState) {
    query.requestState = requestState;
  }

  if (requestKind) {
    query.requestKind = requestKind;
  }

  if (search) {
    query.search = search;
  }

  if (sortBy) {
    query.sortBy = sortBy;
  }

  return query;
}

export function getRequestListRouteStateKey(state) {
  const normalized = normalizeRequestListRouteState({
    requestKind: state?.requestKind,
    requestState: state?.requestState,
    search: state?.search,
    sortBy: state?.sortBy,
  });

  return JSON.stringify([
    normalized.requestKind,
    normalized.requestState,
    normalized.search,
    normalized.sortBy,
  ]);
}
