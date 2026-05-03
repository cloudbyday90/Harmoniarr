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

export function normalizeOperationsRouteState(query = {}) {
  return {
    runId: normalizeRouteValue(query.runId),
  };
}

export function buildOperationsRouteQuery(state = {}) {
  const runId = normalizeRouteValue(state.runId);
  const query = {};

  if (runId) {
    query.runId = runId;
  }

  return query;
}

export function getOperationsRouteStateKey(state) {
  const normalized = normalizeOperationsRouteState({ runId: state?.runId });
  return JSON.stringify([normalized.runId]);
}

export function buildOperationRunDetailLocation(runId) {
  const normalizedRunId = normalizeRouteValue(runId);

  if (!normalizedRunId) {
    return null;
  }

  return {
    name: 'jobs',
    query: buildOperationsRouteQuery({ runId: normalizedRunId }),
  };
}
