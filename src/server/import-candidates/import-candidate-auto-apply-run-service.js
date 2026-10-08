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
import { hasPersistedMusicQueueOwnership } from './import-candidate-music-queue-auto-safe-add-policy.js';

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
  getImportCandidate = null,
  musicQueueAutoSafeAddService = null,
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
      addBlockerCode: policy.addBlockerCode,
      canRecover: policy.canRecover,
      failedCandidateId: importCandidateId,
      failureReason: applyPreview?.summary?.message ?? null,
      ...(policy.recoveryReasonCode ? { recoveryReasonCode: policy.recoveryReasonCode } : {}),
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
    const candidate = typeof getImportCandidate === 'function' ? await getImportCandidate({ importCandidateId }) : null;
    if (hasPersistedMusicQueueOwnership(candidate)) {
      if (typeof musicQueueAutoSafeAddService?.startAutomaticMusicQueueLibraryAdd !== 'function') {
        throw new TypeError('Music Queue automatic library-add service is required');
      }
      try {
        const result = await musicQueueAutoSafeAddService.startAutomaticMusicQueueLibraryAdd({ candidate, requestMetadata });
        return { attempted: true, importCandidateId, started: result.outcome === 'queued', triggerSource: 'download_completed',
          ...(['queued', 'already_queued'].includes(result.outcome) ? { runId: result.runId ?? null } : {}),
          ...(result.outcome === 'already_queued' ? { alreadyQueued: true } : {}),
          ...(result.recovery ? { recovery: result.recovery } : {}),
          ...(result.outcome === 'queued' ? {} : { skippedReason: result.skippedReason
            ?? ({ already_queued: 'apply_run_already_active', deferred: 'apply_run_already_active',
              not_available: 'music_queue_scope_not_current', still_needs_review: 'no_safe_import_pending_candidate' })[result.outcome] }) };
      } catch (error) { return normalizeSkippedApplyRunResult({ error, importCandidateId }); }
    }
    const importBlockerRecovery = await recoverImportBlocker({
      importCandidateId,
    });
    if (importBlockerRecovery) {
      return {
        attempted: true,
        importCandidateId,
        recovery: importBlockerRecovery.recovery,
        skippedReason: importBlockerRecovery.policy.skippedReason
          ?? (importBlockerRecovery.policy.canRecover
            ? 'completed_source_unavailable'
            : 'import_blocker_requires_operator'),
        started: false,
        triggerSource: 'download_completed',
      };
    }

    try {
      const result = await startImportCandidateApplyRun({
        applySafetyMode: 'safe_auto',
        importCandidateIds: [importCandidateId],
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
