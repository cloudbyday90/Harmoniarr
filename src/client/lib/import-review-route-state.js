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

function normalizeRouteValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStatusToken(value) {
  const normalized = normalizeRouteValue(value);
  if (normalized === 'all') {
    return '';
  }

  switch (normalized) {
    case 'held':
    case 'rejected':
    case 'selected':
    case 'downloading':
    case 'import_pending':
    case 'applied':
    case 'failed':
    case 'pending':
      return normalized;
    default:
      return 'pending';
  }
}

export function normalizeImportReviewRouteState(query = {}) {
  return {
    candidateId: normalizeRouteValue(query.candidate),
    folderPath: normalizeRouteValue(query.folderPath),
    sourceSearchId: normalizeRouteValue(query.sourceSearchId),
    status: normalizeStatusToken(query.status),
    username: normalizeRouteValue(query.username),
  };
}

export function buildImportReviewRouteQuery(state = {}) {
  const candidateId = normalizeRouteValue(state.candidateId);
  const folderPath = normalizeRouteValue(state.folderPath);
  const sourceSearchId = normalizeRouteValue(state.sourceSearchId);
  const status = typeof state.status === 'string'
    ? normalizeRouteValue(state.status)
    : 'pending';
  const username = normalizeRouteValue(state.username);
  const query = {};

  if (candidateId) {
    query.candidate = candidateId;
  }

  if (folderPath) {
    query.folderPath = folderPath;
  }

  if (sourceSearchId) {
    query.sourceSearchId = sourceSearchId;
  }

  if (username) {
    query.username = username;
  }

  if (status === '') {
    query.status = 'all';
  } else if (normalizeStatusToken(status) !== 'pending') {
    query.status = normalizeStatusToken(status);
  }

  return query;
}

export function getImportReviewRouteStateKey(state) {
  const normalized = normalizeImportReviewRouteState({
    candidate: state?.candidateId,
    folderPath: state?.folderPath,
    sourceSearchId: state?.sourceSearchId,
    status: state?.status === '' ? 'all' : state?.status,
    username: state?.username,
  });

  return JSON.stringify([
    normalized.candidateId,
    normalized.folderPath,
    normalized.sourceSearchId,
    normalized.status,
    normalized.username,
  ]);
}