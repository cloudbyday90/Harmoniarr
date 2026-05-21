/*
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Format an ISO timestamp for display. Returns `fallback` when the value is
 * absent or unparseable.
 *
 * @param {string|null|undefined} value
 * @param {string} [fallback='Unknown']
 * @returns {string}
 */
export function formatTimestamp(value, fallback = 'Unknown') {
  if (!value) {
    return fallback;
  }

  const ts = new Date(value);
  return Number.isNaN(ts.getTime()) ? value : ts.toLocaleString();
}

/**
 * Format a byte count as a human-readable size string.
 * Returns 'Unknown size' for absent, NaN, or non-positive values.
 *
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function formatBytes(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return 'Unknown size';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Return a filesystem path for display. Falls back to 'Unavailable' for
 * absent or empty values.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function formatPath(value) {
  return value || 'Unavailable';
}

/**
 * Convert an underscore- or hyphen-delimited token (e.g. 'download_enqueue')
 * into a space-separated label. Returns 'unknown' for absent values.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function formatTokenLabel(value) {
  return String(value || 'unknown').replaceAll(/[_-]+/g, ' ');
}

/**
 * Return a display label for a candidate status code.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function candidateStatusLabel(status) {
  switch (status) {
    case 'held':
      return 'Held';
    case 'rejected':
      return 'Rejected';
    case 'selected':
      return 'Selected';
    case 'downloading':
      return 'Downloading';
    case 'import_pending':
      return 'Import pending';
    case 'applied':
      return 'Applied';
    case 'failed':
      return 'Failed';
    default:
      return 'Pending';
  }
}

/**
 * Return a display label for a run status code (execution or apply runs).
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function formatRunStatus(status) {
  switch (status) {
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'completed':
      return 'Completed';
    default:
      return 'Pending';
  }
}

/**
 * Return a display label for an execution mode code.
 *
 * @param {string|null|undefined} mode
 * @returns {string}
 */
export function formatExecutionMode(mode) {
  switch (mode) {
    case 'download_enqueue':
      return 'Queue downloads';
    default:
      return mode || 'Download';
  }
}

/**
 * Format a percentage value for display. Returns 'Unavailable' for
 * non-finite values.
 *
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function formatPercent(value) {
  return Number.isFinite(value) ? `${value}%` : 'Unavailable';
}

/**
 * Returns a UI tone string for an import candidate status, suitable for the
 * `data-tone` attribute on a pill component.
 *
 * - applied            → 'success'
 * - failed / rejected  → 'danger'
 * - downloading        → 'warning'
 * - held / import_pending / selected → 'info'
 * - unknown            → undefined
 *
 * @param {string|null|undefined} status
 * @returns {'success'|'danger'|'warning'|'info'|undefined}
 */
export function candidateStatusTone(status) {
  if (status === 'applied') return 'success';
  if (status === 'failed' || status === 'rejected') return 'danger';
  if (status === 'downloading') return 'warning';
  if (status === 'held' || status === 'import_pending' || status === 'selected') return 'info';
  return undefined;
}

/**
 * Returns a human-readable label for an import candidate source provider
 * token. Hides internal provider identifiers from the UI.
 *
 * - slskd       → 'Soulseek'
 * - musicbrainz → 'MusicBrainz'
 * - unknown/null → '—'
 *
 * @param {string|null|undefined} provider
 * @returns {string}
 */
export function formatSourceProvider(provider) {
  if (!provider || typeof provider !== 'string') return '\u2014';
  switch (provider.toLowerCase()) {
    case 'slskd': return 'Soulseek';
    case 'musicbrainz': return 'MusicBrainz';
    case 'spotify': return 'Spotify';
    case 'youtube': return 'YouTube';
    case 'apple_music': return 'Apple Music';
    default: return provider.charAt(0).toUpperCase() + provider.slice(1).replace(/_/g, ' ');
  }
}

/**
 * Returns a human-readable count label for the number of import candidates,
 * e.g. "1 candidate" or "4 candidates".
 *
 * @param {number} count
 * @returns {string}
 */
export function formatCandidateCountLabel(count) {
  return count === 1 ? '1 candidate' : `${count} candidates`;
}

// ---------------------------------------------------------------------------
// Apply-run display helpers
// ---------------------------------------------------------------------------

/**
 * Return a CSS class suffix for an apply-run status.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getRunStatusClass(status) {
  switch (status) {
    case 'running':
      return 'review-status-selected';
    case 'failed':
      return 'review-status-failed';
    case 'completed':
      return 'review-status-held';
    default:
      return 'review-status-pending';
  }
}

/**
 * Return a CSS class suffix for an apply-item status.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getApplyItemStatusClass(status) {
  switch (status) {
    case 'blocked':
    case 'apply_failed':
      return 'review-status-failed';
    case 'applied_with_warnings':
    case 'ready_with_warnings':
      return 'review-status-held';
    case 'applied':
    default:
      return 'review-status-selected';
  }
}

/**
 * Return a display label for an apply-item status.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getApplyItemStatusLabel(status) {
  switch (status) {
    case 'blocked':
      return 'Blocked';
    case 'apply_failed':
      return 'Apply failed';
    case 'applied_with_warnings':
      return 'Applied with warnings';
    case 'applied':
      return 'Applied';
    case 'ready_with_warnings':
      return 'Ready with warnings';
    default:
      return 'Ready';
  }
}

/**
 * Return a CSS class suffix for a file-operation status within an apply run.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getApplyOperationStatusClass(status) {
  switch (status) {
    case 'failed':
      return 'review-status-failed';
    case 'not_attempted':
      return 'review-status-pending';
    case 'skipped':
      return 'review-status-held';
    default:
      return 'review-status-selected';
  }
}

/**
 * Return a display label for a file-operation status within an apply run.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getApplyOperationStatusLabel(status) {
  switch (status) {
    case 'failed':
      return 'Failed';
    case 'not_attempted':
      return 'Not attempted';
    case 'skipped':
      return 'Skipped';
    default:
      return 'Applied';
  }
}

/**
 * Return a display label for an apply-operation step type.
 *
 * @param {string|null|undefined} stepType
 * @returns {string}
 */
export function getApplyOperationStepLabel(stepType) {
  return stepType === 'finalize' ? 'Finalize' : 'Stage';
}

/**
 * Return the display name for a filesystem mutation mode.
 * Recognised values: 'hardlink', 'copy'. All others (including the default
 * server mode) render as 'move'.
 *
 * @param {string|null|undefined} mode
 * @returns {string}
 */
export function formatApplyMutationMode(mode) {
  if (mode === 'hardlink') return 'hardlink';
  if (mode === 'copy') return 'copy';
  return 'move';
}

/**
 * Return a human-readable explanation for a filesystem-level fallback reason.
 *
 * @param {string|null|undefined} reason
 * @returns {string}
 */
export function formatApplyFallbackReason(reason) {
  if (reason === 'cross_device') {
    return 'the source and destination were on different filesystem devices';
  }
  return reason || 'the filesystem could not honor the requested mutation mode';
}

/**
 * Build a human-readable description for a single file operation within an
 * apply run.  Prefers an explicit error message, then describes the fallback
 * pathway when one occurred, and otherwise summarises the step/status/transport.
 *
 * @param {object|null|undefined} operation
 * @returns {string}
 */
export function describeApplyOperation(operation) {
  if (operation?.errorMessage) {
    return operation.errorMessage;
  }

  if (operation?.fallbackFromMode) {
    return `${getApplyOperationStepLabel(operation?.stepType)} ${operation?.status || 'pending'} via ${formatApplyMutationMode(operation.fallbackFromMode)} fallback to ${formatApplyMutationMode(operation?.appliedMode)} because ${formatApplyFallbackReason(operation?.fallbackReason)}`;
  }

  return `${getApplyOperationStepLabel(operation?.stepType)} ${operation?.status || 'pending'} via ${operation?.transport || 'planned apply'}`;
}

/**
 * Return the relevant list of file operations for a given apply-item.
 * Prefers live `importOperations` if present; falls back to the snapshotted
 * `applySnapshot.fileOperations`.
 *
 * @param {object|null|undefined} item
 * @returns {Array}
 */
export function getApplyItemOperationHistory(item) {
  if (Array.isArray(item?.importOperations) && item.importOperations.length > 0) {
    return item.importOperations;
  }

  return Array.isArray(item?.applySnapshot?.fileOperations)
    ? item.applySnapshot.fileOperations
    : [];
}

/**
 * Return whether a new apply run can be started given the current run state
 * and the number of pending import candidates.
 *
 * A run can be started when there is no current run, or the current run has
 * finished (i.e. is neither pending nor running) and there are candidates
 * waiting.
 *
 * @param {object|null|undefined} currentRun
 * @param {number} importPendingCandidateCount
 * @returns {boolean}
 */
export function canStartApplyRun(currentRun, importPendingCandidateCount) {
  return !currentRun || (
    currentRun.status !== 'pending' &&
    currentRun.status !== 'running' &&
    importPendingCandidateCount > 0
  );
}

/**
 * Return a CSS class suffix for an execution-run item queue status pill.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getExecutionItemStatusClass(status) {
  switch (status) {
    case 'blocked':
    case 'queue_failed':
      return 'review-status-failed';
    case 'queued_with_warnings':
    case 'ready_with_warnings':
      return 'review-status-held';
    case 'queued':
    default:
      return 'review-status-selected';
  }
}

/**
 * Return a human-readable label for an execution-run item queue status.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getExecutionItemStatusLabel(status) {
  switch (status) {
    case 'blocked':
      return 'Blocked';
    case 'queue_failed':
      return 'Queue failed';
    case 'queued_with_warnings':
      return 'Queued with warnings';
    case 'queued':
      return 'Queued';
    case 'ready_with_warnings':
      return 'Ready with warnings';
    default:
      return 'Ready';
  }
}

/**
 * Return a human-readable label for a live slskd transfer summary.
 *
 * Returns 'Not reconciled' when no summary is provided so the UI always has
 * something to display.
 *
 * @param {object|null|undefined} summary
 * @returns {string}
 */
export function formatLiveTransferStatus(summary) {
  if (!summary) return 'Not reconciled';
  switch (summary.status) {
    case 'active':
      return 'Active';
    case 'queued':
      return 'Queued remotely';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'not_found':
      return summary.missingTransfer?.isPastGracePeriod ? 'Orphaned' : 'Missing remotely';
    default:
      return 'Missing';
  }
}

/**
 * Return a CSS class suffix for a live transfer summary status pill.
 *
 * @param {object|null|undefined} summary
 * @returns {string}
 */
export function getLiveTransferStatusClass(summary) {
  switch (summary?.status) {
    case 'active':
      return 'review-status-selected';
    case 'queued':
      return 'review-status-pending';
    case 'completed':
      return 'review-status-held';
    case 'failed':
      return 'review-status-failed';
    case 'not_found':
      return summary?.missingTransfer?.isPastGracePeriod
        ? 'review-status-failed'
        : 'review-status-pending';
    default:
      return 'review-status-pending';
  }
}

/**
 * Return the persisted transfer observation for a run item, or null.
 *
 * @param {object|null|undefined} item
 * @returns {object|null}
 */
export function getPersistedTransferObservation(item) {
  return item?.persistedTransferObservation ?? null;
}

/**
 * Return the latest transfer summary from a run item's persisted observation,
 * or null if absent.
 *
 * @param {object|null|undefined} item
 * @returns {object|null}
 */
export function getLatestTransferSummary(item) {
  return getPersistedTransferObservation(item)?.summary ?? null;
}

/**
 * Return the persisted missing-transfer record for a run item, or null.
 *
 * @param {object|null|undefined} item
 * @returns {object|null}
 */
export function getPersistedMissingTransfer(item) {
  return item?.persistedMissingTransfer ?? null;
}

/**
 * Return a human-readable label for the last outcome of an import execution
 * heartbeat.
 *
 * @param {object|null|undefined} heartbeat
 * @returns {string}
 */
export function getHeartbeatOutcomeLabel(heartbeat) {
  switch (heartbeat?.state?.lastOutcome) {
    case 'started':
      return 'Reconciled automatically';
    case 'error':
      return 'Heartbeat error';
    case 'skipped':
      return 'Skipped';
    default:
      return 'Not yet recorded';
  }
}

/**
 * Return a human-readable label for the last heartbeat skip reason.
 *
 * @param {string|null|undefined} reason
 * @returns {string}
 */
export function getHeartbeatSkipReasonLabel(reason) {
  switch (reason) {
    case 'not_due':
      return 'No actionable transfer updates were visible.';
    case 'tick_in_progress':
      return 'A previous reconciliation tick was still running.';
    case 'error':
      return 'The last heartbeat tick failed.';
    default:
      return 'None';
  }
}

/**
 * Return whether a new execution run can be started given the current run
 * state and the number of selected candidates.
 *
 * A run can be started when there is no current run, or the current run has
 * finished (i.e. is neither pending nor running) and there are selected
 * candidates waiting.
 *
 * @param {object|null|undefined} currentRun
 * @param {number} selectedCandidateCount
 * @returns {boolean}
 */
export function canStartExecutionRun(currentRun, selectedCandidateCount) {
  return !currentRun || (
    currentRun.status !== 'pending' &&
    currentRun.status !== 'running' &&
    selectedCandidateCount > 0
  );
}

/**
 * Return whether a new media inspection run can be started.
 *
 * A run can be started when there is no current run, or the current run has
 * finished (i.e. is neither pending nor running) and there are selected
 * candidates waiting.
 *
 * @param {object|null|undefined} currentRun
 * @param {number} selectedCandidateCount
 * @returns {boolean}
 */
export function canStartMediaInspectionRun(currentRun, selectedCandidateCount) {
  return !currentRun || (
    currentRun.status !== 'pending' &&
    currentRun.status !== 'running' &&
    selectedCandidateCount > 0
  );
}

export function formatUploaderReviewState(reviewState) {
  switch (reviewState) {
    case 'excluded':
      return 'Blocked';
    case 'healthy':
      return 'Healthy';
    case 'normal':
      return 'Normal';
    case 'preferred':
      return 'Trusted';
    case 'unknown':
      return 'New';
    case 'watch':
      return 'Watch';
    default:
      return 'Unknown';
  }
}

export function formatUploaderReviewTone(reviewState) {
  switch (reviewState) {
    case 'excluded':
      return 'danger';
    case 'healthy':
    case 'preferred':
      return 'success';
    case 'watch':
      return 'warning';
    case 'normal':
      return 'info';
    default:
      return 'muted';
  }
}

export function formatUploaderReputationEvidence(reputation) {
  if (!reputation || reputation.evidenceCount < 1) {
    return 'No history';
  }

  const rate = reputation.successRate !== null
    ? `${Math.round(reputation.successRate * 100)}%`
    : 'N/A';
  return `${reputation.successCount}/${reputation.evidenceCount} (${rate})`;
}
