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

const skippedReasonByErrorCode = Object.freeze({
  import_candidate_apply_in_progress: 'apply_run_already_active',
  import_candidate_apply_not_ready: 'no_safe_import_pending_candidate',
  recovery_lock_conflict: 'maintenance_lock_active',
});

function normalizeSkippedApplyRunResult({ error, importCandidateId }) {
  const skippedReason = skippedReasonByErrorCode[error?.code];
  if (!skippedReason) {
    throw error;
  }

  return {
    attempted: true,
    errorCode: error.code,
    importCandidateId,
    skippedReason,
    started: false,
    triggerSource: 'download_completed',
  };
}

export function createImportCandidateAutoApplyRunService({
  startImportCandidateApplyRun = async () => {
    throw new Error('startImportCandidateApplyRun dependency is required');
  },
} = {}) {
  async function startSafeApplyRunAfterDownloadCompleted({
    importCandidateId,
    requestMetadata = null,
  } = {}) {
    try {
      const result = await startImportCandidateApplyRun({
        applySafetyMode: 'safe_auto',
        requestMetadata,
        triggeredByUserId: null,
        triggerSource: 'download_completed',
      });

      return {
        attempted: true,
        importCandidateId,
        runId: result.run?.id ?? null,
        started: true,
        triggerSource: 'download_completed',
      };
    } catch (error) {
      return normalizeSkippedApplyRunResult({ error, importCandidateId });
    }
  }

  return {
    startSafeApplyRunAfterDownloadCompleted,
  };
}
