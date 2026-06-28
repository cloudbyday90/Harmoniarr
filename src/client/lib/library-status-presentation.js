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
 * Library status presentation helpers.
 *
 * Pure, framework-free functions for the four library dashboard summary
 * panels: discovery dispatch queue, library scan, library reconciliation, and
 * wanted reconciliation. Extracted from component inline functions so they can
 * be independently tested and shared without Vue dependencies.
 */

// ── Discovery dispatch queue ─────────────────────────────────────────────────

/**
 * Return a CSS class for a discovery queue status code.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getDiscoveryQueueStatusClass(status) {
  switch (status) {
    case 'ready':
      return 'review-status-selected';
    case 'cooldown':
      return 'review-status-pending';
    case 'blocked':
      return 'review-status-held';
    default:
      return 'review-status-held';
  }
}

/**
 * Return a display label for a discovery queue status code.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getDiscoveryQueueStatusLabel(status) {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'cooldown':
      return 'Cooling down';
    case 'blocked':
      return 'Blocked';
    default:
      return 'Empty';
  }
}

/**
 * Return a display label for a dispatch trigger source identifier.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function getTriggerSourceLabel(value) {
  switch (value) {
    case 'heartbeat':
      return 'Heartbeat';
    case 'manual':
      return 'Manual';
    default:
      return 'Unavailable';
  }
}

/**
 * Return a display label for the last outcome recorded on a discovery
 * heartbeat state object.
 *
 * Accepts the `state` object (i.e. `heartbeat.state`), not the heartbeat root.
 *
 * @param {object|null|undefined} state
 * @returns {string}
 */
export function getDiscoveryHeartbeatOutcomeLabel(state) {
  switch (state?.lastOutcome) {
    case 'started':
      return 'Started automatic run';
    case 'error':
      return 'Automatic run errored';
    case 'skipped':
      return 'Skipped automatic run';
    default:
      return 'Not yet recorded';
  }
}

/**
 * Return a display label for a discovery heartbeat skip reason code.
 *
 * @param {string|null|undefined} reason
 * @returns {string}
 */
export function getDiscoveryHeartbeatSkipReasonLabel(reason) {
  switch (reason) {
    case 'not_due':
      return 'Not due';
    case 'run_in_progress':
      return 'Run in progress';
    case 'tick_in_progress':
      return 'Tick already running';
    case 'error':
      return 'Error';
    default:
      return 'None';
  }
}

/**
 * Return whether a new discovery dispatch run can be manually started.
 *
 * A dispatch can be started when the summary payload is present, at least one
 * request is in the queue, and the latest run is not already pending or
 * actively running.
 *
 * @param {object|null|undefined} summaryPayload
 * @returns {boolean}
 */
export function canStartDiscoveryDispatch(summaryPayload) {
  if (!summaryPayload) {
    return false;
  }

  if ((summaryPayload.requestCounts?.totalRequests ?? 0) === 0) {
    return false;
  }

  return !['pending', 'running'].includes(summaryPayload.latestRun?.status);
}

export function buildDiscoveryDispatchHandoffMessage(summaryPayload) {
  const ready = summaryPayload?.requestCounts?.ready ?? 0;
  const cooldown = summaryPayload?.requestCounts?.cooldown ?? 0;
  const blocked = summaryPayload?.requestCounts?.blocked ?? 0;
  const latestRun = summaryPayload?.latestRun ?? null;

  if (ready > 0) {
    return `${ready} ${ready === 1 ? 'release is' : 'releases are'} ready for Soulseek search dispatch.`;
  }

  if (['pending', 'running'].includes(latestRun?.status)) {
    return 'Discovery dispatch is already running. Results will appear in Import Review or Downloader after searches return.';
  }

  if (cooldown > 0) {
    return `${cooldown} ${cooldown === 1 ? 'release is' : 'releases are'} cooling down before the next automatic search.`;
  }

  if (blocked > 0) {
    return `${blocked} ${blocked === 1 ? 'release is' : 'releases are'} blocked by release-date or recovery policy.`;
  }

  return 'No discovery searches are waiting right now.';
}

// ── Library scan ─────────────────────────────────────────────────────────────

/**
 * Return a display label for a library scan readiness status code.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getLibraryScanReadinessLabel(status) {
  return status === 'ready' ? 'Ready' : 'Blocked';
}

/**
 * Return a CSS class for a library scan readiness status code.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getLibraryScanReadinessClass(status) {
  return status === 'ready' ? 'review-status-selected' : 'review-status-held';
}

/**
 * Return whether a new library scan can be manually started.
 *
 * A scan can be started when the scan summary is present, the path readiness
 * status is 'ready', and the latest run is not already pending or actively
 * running.
 *
 * @param {object|null|undefined} scanSummary
 * @returns {boolean}
 */
export function canStartLibraryScan(scanSummary) {
  if (!scanSummary || scanSummary.readiness?.status !== 'ready') {
    return false;
  }

  return !['pending', 'running'].includes(scanSummary.latestRun?.status);
}

/**
 * Return the label for the start-scan button based on scan history.
 *
 * @param {object|null|undefined} scanSummary
 * @returns {string}
 */
export function getLibraryScanStartLabel(scanSummary) {
  return scanSummary?.latestRun ? 'Run again' : 'Start scan';
}

// ── Library reconciliation ───────────────────────────────────────────────────

/**
 * Return a CSS class for a library reconciliation status code.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getLibraryReconciliationStatusClass(status) {
  switch (status) {
    case 'complete':
      return 'review-status-selected';
    case 'partial':
    case 'incomplete':
      return 'review-status-pending';
    case 'review_required':
      return 'review-status-failed';
    default:
      return 'review-status-held';
  }
}

/**
 * Return a display label for a library reconciliation status code.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getLibraryReconciliationStatusLabel(status) {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'partial':
      return 'Partial';
    case 'review_required':
      return 'Review required';
    case 'incomplete':
      return 'Incomplete';
    default:
      return 'Empty';
  }
}

// ── Wanted reconciliation ────────────────────────────────────────────────────

/**
 * Return a CSS class for a wanted reconciliation status code.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getWantedReconciliationStatusClass(status) {
  switch (status) {
    case 'complete':
      return 'review-status-selected';
    case 'partial':
      return 'review-status-pending';
    case 'wanted':
      return 'review-status-failed';
    default:
      return 'review-status-held';
  }
}

/**
 * Return a display label for a wanted reconciliation status code.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getWantedReconciliationStatusLabel(status) {
  switch (status) {
    case 'complete':
      return 'Satisfied';
    case 'partial':
      return 'Partially missing';
    case 'wanted':
      return 'Wanted';
    default:
      return 'Empty';
  }
}
