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

function normalizeRunId(value) {
  return normalizeRouteValue(value);
}

export function normalizeImportReviewRouteState(query = {}) {
  return {
    applyRunId: normalizeRunId(query.applyRunId),
    candidateId: normalizeRouteValue(query.candidate),
    executionRunId: normalizeRunId(query.executionRunId),
    folderPath: normalizeRouteValue(query.folderPath),
    sourceSearchId: normalizeRouteValue(query.sourceSearchId),
    status: normalizeStatusToken(query.status),
    username: normalizeRouteValue(query.username),
  };
}

export function buildImportReviewRouteQuery(state = {}) {
  const applyRunId = normalizeRunId(state.applyRunId);
  const candidateId = normalizeRouteValue(state.candidateId);
  const executionRunId = normalizeRunId(state.executionRunId);
  const folderPath = normalizeRouteValue(state.folderPath);
  const sourceSearchId = normalizeRouteValue(state.sourceSearchId);
  const status = typeof state.status === 'string'
    ? normalizeRouteValue(state.status)
    : 'pending';
  const username = normalizeRouteValue(state.username);
  const query = {};

  if (applyRunId) {
    query.applyRunId = applyRunId;
  }

  if (candidateId) {
    query.candidate = candidateId;
  }

  if (executionRunId) {
    query.executionRunId = executionRunId;
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
    applyRunId: state?.applyRunId,
    candidate: state?.candidateId,
    executionRunId: state?.executionRunId,
    folderPath: state?.folderPath,
    sourceSearchId: state?.sourceSearchId,
    status: state?.status === '' ? 'all' : state?.status,
    username: state?.username,
  });

  return JSON.stringify([
    normalized.applyRunId,
    normalized.candidateId,
    normalized.executionRunId,
    normalized.folderPath,
    normalized.sourceSearchId,
    normalized.status,
    normalized.username,
  ]);
}

export function buildImportReviewExecutionRunLocation(runId) {
  return {
    hash: '#import-execution-run-panel',
    name: 'review-queue',
    query: buildImportReviewRouteQuery({
      executionRunId: runId,
    }),
  };
}

export function buildImportReviewApplyRunLocation(runId) {
  return {
    hash: '#import-apply-run-panel',
    name: 'review-queue',
    query: buildImportReviewRouteQuery({
      applyRunId: runId,
    }),
  };
}