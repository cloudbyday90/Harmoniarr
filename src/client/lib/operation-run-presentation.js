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

/**
 * Formats a timestamp as a full locale datetime string for technical details.
 * Returns 'Not yet recorded' for falsy or unparseable values.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function formatOperationTimestamp(value) {
  if (!value) return 'Not yet recorded';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

/**
 * Formats a timestamp as a short relative or time-of-day string.
 * Returns '—' for falsy or unparseable values.
 *
 * @param {string|null|undefined} value
 * @param {{ nowFn?: () => number }} [options]
 * @returns {string}
 */
export function formatOperationTimestampShort(value, { nowFn = () => Date.now() } = {}) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const diffMs = nowFn() - d.getTime();
  if (diffMs < 60_000) return 'Just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString();
}

/**
 * Maps a run status value to a design-system tone token.
 * Returns null for completed and unknown statuses (no special tone).
 *
 * @param {string|null|undefined} status
 * @returns {'danger'|'warning'|'success'|null}
 */
export function formatOperationRunStatusTone(status) {
  switch (status) {
    case 'failed': return 'danger';
    case 'cancelled': return 'warning';
    case 'running': return 'success';
    default: return null;
  }
}

/**
 * Maps a run group ID to a design-system tone token.
 * Returns null for completed group and unknown IDs.
 *
 * @param {string|null|undefined} groupId
 * @returns {'danger'|'success'|null}
 */
export function formatOperationGroupTone(groupId) {
  switch (groupId) {
    case 'needs-attention': return 'danger';
    case 'in-progress': return 'success';
    default: return null;
  }
}

/**
 * Maps a lease state value to a human-readable label.
 *
 * @param {string|null|undefined} state
 * @returns {string}
 */
export function formatLeaseStateLabel(state) {
  switch (state) {
    case 'active': return 'Active';
    case 'expired': return 'Expired';
    case 'released': return 'Released';
    default: return 'Unknown';
  }
}

/**
 * Maps a lease state value to a design-system tone token.
 * Returns null for released and unknown states.
 *
 * @param {string|null|undefined} state
 * @returns {'success'|'danger'|null}
 */
export function formatLeaseStateTone(state) {
  switch (state) {
    case 'active': return 'success';
    case 'expired': return 'danger';
    default: return null;
  }
}

/**
 * Converts a run summary object to an array of display entries, filtering
 * out null/undefined values and capping at 12 items.
 *
 * @param {Record<string, unknown>|null|undefined} summary
 * @returns {Array<{key: string, value: unknown}>}
 */
export function buildOperationSummaryEntries(summary) {
  return Object.entries(summary ?? {})
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => ({ key, value }))
    .slice(0, 12);
}

/**
 * Converts a camelCase or snake_case summary key to a Title Case display label.
 *
 * @param {string} key
 * @returns {string}
 */
export function formatOperationSummaryLabel(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Formats a summary entry value for display.
 *
 * - Arrays: reports record count
 * - Booleans: Yes / No
 * - Objects: generic label
 * - Everything else: String coercion
 *
 * @param {unknown} value
 * @returns {string}
 */
export function formatOperationSummaryValue(value) {
  if (Array.isArray(value)) return `${value.length} record${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object' && value !== null) return 'Structured data recorded';
  return String(value);
}

/**
 * Converts a raw operation audit event type identifier to a human-readable
 * label. Handles snake_case identifiers and falls back to title-casing unknowns.
 *
 * @param {string|null|undefined} eventType
 * @returns {string}
 */
export function formatOperationEventTypeLabel(eventType) {
  if (!eventType || typeof eventType !== 'string') return '';
  const known = {
    run_started: 'Run started',
    run_completed: 'Run completed',
    run_failed: 'Run failed',
    run_cancelled: 'Run cancelled',
    run_cancellation_requested: 'Cancellation requested',
    run_retried: 'Run retried',
    run_queued: 'Run queued',
    step_started: 'Step started',
    step_completed: 'Step completed',
    step_failed: 'Step failed',
    step_skipped: 'Step skipped',
    run_claimed: 'Processing started',
    run_heartbeat: 'Progress check-in',
  };
  return known[eventType] ?? eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Queue-specific status helpers ─────────────────────────────────────────────

/**
 * Status strings used by the operation history / queue endpoint.
 * These differ from the Operations view statuses: `in_progress` and `claimed`
 * are used instead of `running`, and `succeeded`/`queued` appear alongside
 * the shared set.
 */
const QUEUE_STATUS_LABELS = Object.freeze({
  succeeded: 'Succeeded',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  pending: 'Queued',
  queued: 'Queued',
  in_progress: 'In progress',
  claimed: 'In progress',
});

/**
 * Returns a plain-English label for an operation queue run status string.
 * Handles the extended status vocabulary used by the operation history
 * endpoint (`succeeded`, `queued`, `in_progress`, `claimed`).
 * Unknown statuses are title-cased as a fallback.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function formatQueueRunStatusLabel(status) {
  if (typeof status !== 'string' || !status) return '—';
  if (QUEUE_STATUS_LABELS[status] !== undefined) return QUEUE_STATUS_LABELS[status];
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns a UI tone string for an operation queue run status, suitable for
 * `data-tone` on a pill component.
 *
 * - succeeded/completed → 'success'
 * - failed/cancelled → 'danger'
 * - in_progress/claimed → 'warning'
 * - pending/queued → 'info'
 * - unknown → undefined (no tone applied)
 *
 * @param {string|null|undefined} status
 * @returns {'success'|'danger'|'warning'|'info'|undefined}
 */
export function formatQueueRunStatusTone(status) {
  if (status === 'succeeded' || status === 'completed') return 'success';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  if (status === 'in_progress' || status === 'claimed') return 'warning';
  if (status === 'pending' || status === 'queued') return 'info';
  return undefined;
}

// ── Elapsed duration ──────────────────────────────────────────────────────────

/**
 * Formats the elapsed time between two ISO 8601 timestamps as a concise
 * human-readable string, e.g. "4s", "2m 15s", "1h 3m".
 *
 * - If `endIso` is omitted or null, `nowFn()` is used as the end time so
 *   the duration reflects the time elapsed so far for a running operation.
 * - Returns '—' when `startIso` is falsy or unparseable.
 * - Returns '0s' when the computed duration is zero or negative (clock skew
 *   guard).
 *
 * @param {string|null|undefined} startIso
 * @param {string|null|undefined} endIso
 * @param {{ nowFn?: () => number }} [options]
 * @returns {string}
 */
export function formatElapsedDuration(startIso, endIso = null, { nowFn = () => Date.now() } = {}) {
  if (!startIso) return '—';
  const startMs = Date.parse(startIso);
  if (!Number.isFinite(startMs)) return '—';
  const endMs = endIso ? Date.parse(endIso) : nowFn();
  if (!Number.isFinite(endMs)) return '—';
  const totalSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const remSeconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${remSeconds}s`;
}