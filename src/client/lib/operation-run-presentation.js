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

import {
  canRequestOperationRunRetry,
  getOperationRunDescriptor,
} from './operation-run-link-targets.js';

const operationRunGroups = Object.freeze([
  Object.freeze({
    description: 'Failed or cancelled work that may need follow-up before automation can continue cleanly.',
    id: 'needs-attention',
    title: 'Needs attention',
  }),
  Object.freeze({
    description: 'Work that is queued or currently running. Review here when you need to watch progress or stop a run.',
    id: 'in-progress',
    title: 'In progress',
  }),
  Object.freeze({
    description: 'Recently completed work. Use this for spot checks instead of treating every finished run as an alert.',
    id: 'completed',
    title: 'Recently completed',
  }),
]);

function getOperationTitle(run) {
  return getOperationRunDescriptor(run?.operationType).title;
}

export function getOperationRunAttentionLevel(run) {
  switch (run?.status) {
    case 'failed':
    case 'cancelled':
      return 'high';
    case 'pending':
    case 'running':
      return 'medium';
    case 'completed':
      return 'low';
    default:
      return 'low';
  }
}

export function getOperationRunAttentionLabel(run) {
  switch (getOperationRunAttentionLevel(run)) {
    case 'high':
      return 'Needs attention';
    case 'medium':
      return 'In progress';
    default:
      return 'Informational';
  }
}

export function getOperationRunOperatorSummary(run) {
  const operationTitle = getOperationTitle(run);

  switch (run?.status) {
    case 'failed':
      return `${operationTitle} stopped before completion and should be reviewed before it is retried.`;
    case 'cancelled':
      return `${operationTitle} was stopped before completion. Review whether it should stay cancelled or be run again.`;
    case 'pending':
      return run?.nextAttemptAt
        ? `${operationTitle} is queued to try again after the current delay window.`
        : `${operationTitle} is queued and waiting for a worker to pick it up.`;
    case 'running':
      return run?.cancelRequestedAt
        ? `${operationTitle} is still running while a cancellation request is being processed.`
        : `${operationTitle} is actively running now.`;
    case 'completed':
      return `${operationTitle} completed successfully and its recorded outcome is available below.`;
    default:
      return `${operationTitle} is recorded here for operator review.`;
  }
}

export function getOperationRunNextStep(run) {
  switch (run?.status) {
    case 'failed':
      return canRequestOperationRunRetry(run)
        ? 'Review the failure details, fix the underlying problem, then retry the run when you are ready.'
        : 'Review the failure details and owning workflow before rerunning this work through another path.';
    case 'cancelled':
      return canRequestOperationRunRetry(run)
        ? 'Leave it cancelled if the stop was intentional, or retry it when you want the work to continue.'
        : 'No immediate action is required unless this work still needs to happen through its owning workflow.';
    case 'pending':
      return 'No immediate action is required unless the queue appears stuck or you need to cancel the pending work.';
    case 'running':
      return run?.cancelRequestedAt
        ? 'Wait for the cancellation request to finish unless the run becomes stuck.'
        : 'Let it continue unless you need to stop it because the job is no longer safe or necessary.';
    case 'completed':
      return 'No action is required unless you want to inspect the owning workflow or review the recorded outcome.';
    default:
      return 'Use the owning workflow link or the technical details below if you need deeper diagnostics.';
  }
}

export function groupOperationRunsForDisplay(runs) {
  const groupedRuns = new Map(operationRunGroups.map((group) => [group.id, []]));

  for (const run of runs ?? []) {
    if (run?.status === 'failed' || run?.status === 'cancelled') {
      groupedRuns.get('needs-attention').push(run);
      continue;
    }

    if (run?.status === 'pending' || run?.status === 'running') {
      groupedRuns.get('in-progress').push(run);
      continue;
    }

    groupedRuns.get('completed').push(run);
  }

  return operationRunGroups
    .map((group) => ({
      ...group,
      runs: groupedRuns.get(group.id),
    }))
    .filter((group) => group.runs.length > 0);
}

/**
 * Returns a human-readable duration string for a run.
 *
 * - Running / pending runs: time elapsed from startedAt to now.
 * - Finished runs: time from startedAt to finishedAt.
 * - Returns null when startedAt is absent or unparseable.
 *
 * @param {object|null} run
 * @param {{ nowFn?: () => number }} [options]
 * @returns {string|null}
 */
export function getOperationRunDuration(run, { nowFn = () => Date.now() } = {}) {
  if (!run?.startedAt) return null;
  const start = new Date(run.startedAt).getTime();
  if (Number.isNaN(start)) return null;

  const isActive = run.status === 'running' || run.status === 'pending';
  const end = isActive ? nowFn() : (run.finishedAt ? new Date(run.finishedAt).getTime() : null);
  if (end === null) return null;

  const ms = end - start;
  if (ms < 0) return null;

  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}