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

import { evaluateImportBlockerRecovery } from './import-candidate-terminal-recovery-policy.js';

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
  handleImportCandidateImportBlocker = null,
  previewImportCandidateApply = null,
  startImportCandidateApplyRun = async () => {
    throw new Error('startImportCandidateApplyRun dependency is required');
  },
} = {}) {
  async function recoverImportBlocker({ importCandidateId }) {
    if (typeof previewImportCandidateApply !== 'function'
      || typeof handleImportCandidateImportBlocker !== 'function') {
      return null;
    }

    let applyPreview;
    try {
      applyPreview = await previewImportCandidateApply({ importCandidateId });
    } catch {
      return null;
    }

    const policy = evaluateImportBlockerRecovery(applyPreview);
    if (!policy.outcomeCode) {
      return null;
    }

    const recovery = await handleImportCandidateImportBlocker({
      canRecover: policy.canRecover,
      failedCandidateId: importCandidateId,
      failureReason: applyPreview?.summary?.message ?? null,
      scheduleFollowUpRun: true,
    });

    return {
      policy,
      recovery,
    };
  }

  async function startSafeApplyRunAfterDownloadCompleted({
    importCandidateId,
    requestMetadata = null,
  } = {}) {
    const importBlockerRecovery = await recoverImportBlocker({
      importCandidateId,
    });
    if (importBlockerRecovery) {
      return {
        attempted: true,
        importCandidateId,
        recovery: importBlockerRecovery.recovery,
        skippedReason: importBlockerRecovery.policy.canRecover
          ? 'completed_source_unavailable'
          : 'import_blocker_requires_operator',
        started: false,
        triggerSource: 'download_completed',
      };
    }

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
