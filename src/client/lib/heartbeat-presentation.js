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
 * Return a human-readable label for a background-service heartbeat status.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function formatHeartbeatStatus(status) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'error':
      return 'Error';
    case 'idle':
      return 'Idle';
    case 'paused':
      return 'Paused';
    case 'running':
      return 'Running';
    default:
      return 'Waiting';
  }
}

/**
 * Return a CSS class suffix for a background-service heartbeat status pill.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getHeartbeatStatusClass(status) {
  switch (status) {
    case 'error':
      return 'review-status-failed';
    case 'running':
    case 'idle':
      return 'review-status-selected';
    default:
      return 'review-status-held';
  }
}

/**
 * Reduce a list of dependency/heartbeat status strings to the single worst
 * overall health status.  Priority: unavailable/error > degraded/rate_limited/
 * misconfigured > healthy > unknown (empty or unrecognised input).
 *
 * @param {string[]} statuses
 * @returns {'unavailable'|'degraded'|'healthy'|'unknown'}
 */
export function selectWorstDependencyStatus(statuses) {
  if (statuses.includes('unavailable') || statuses.includes('error')) {
    return 'unavailable';
  }
  if (statuses.includes('degraded') || statuses.includes('rate_limited') || statuses.includes('misconfigured')) {
    return 'degraded';
  }
  if (statuses.includes('healthy')) {
    return 'healthy';
  }
  return 'unknown';
}

/**
 * Return a human-readable detail string for the shell health badge based on
 * the worst-status value returned by `selectWorstDependencyStatus`.
 *
 * @param {string|null|undefined} worstStatus
 * @returns {string}
 */
export function buildShellHeartbeatDetail(worstStatus) {
  switch (worstStatus) {
    case 'healthy':
      return 'All dependencies healthy';
    case 'degraded':
      return 'Some dependencies degraded';
    case 'unavailable':
      return 'Dependencies unavailable';
    default:
      return 'Health unknown';
  }
}

/**
 * Return a short display label for the shell health badge status.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function buildShellHeartbeatStatusLabel(status) {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'degraded':
      return 'Degraded';
    case 'unavailable':
      return 'Unavailable';
    default:
      return 'Health';
  }
}
