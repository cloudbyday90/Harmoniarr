/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
export function buildBackupRecoveryStatus(status, { loading = false } = {}) {
  if (loading && !status) return { state: 'loading', message: 'Checking startup backup recovery status.' };
  if (!status) return { state: 'unknown', message: 'Startup backup recovery status is not available. Refresh status to check again.' };
  if (status.admissionState === 'failed') return { state: 'failed', message: 'Startup backup recovery could not be queued. Review database health and restart the application when it is ready.' };
  const unfinished = count(status.unfinishedCount), confirmation = count(status.confirmationCount);
  const replayNote = status.progressMayBeIncomplete === true
    ? ' Recorded job totals may omit work completed before an interruption. Unfinished counts reflect the last status check.' : '';
  const detail = ` ${unfinished} unfinished backup operations; ${confirmation} need confirmation.` + replayNote;
  if (status.state === 'pending') return { state: 'pending', message: 'Backup recovery is queued or paused. Open Background Jobs for progress.' + detail };
  if (status.state === 'running') return { state: 'running', message: 'Backup recovery is checking interrupted operations.' + detail };
  if (status.state === 'failed' || status.state === 'cancelled') return { state: status.state, message: 'Backup recovery stopped before its scan finished. Review Background Jobs.' + detail };
  if (status.state === 'completed') return {
state: unfinished ? 'attention' : 'completed', message: unfinished
      ? 'Backup recovery scan finished. Some operations remain unresolved; review Recovery before another attempt.' + detail
      : 'Backup recovery scan finished. No unfinished backup operations were found at the last status check.' + replayNote
};
  return { state: 'not_started', message: 'Startup backup recovery has not been queued in this application process.' + detail };
}
