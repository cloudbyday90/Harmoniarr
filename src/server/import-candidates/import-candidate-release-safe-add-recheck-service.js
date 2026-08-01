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

import { IMPORT_CANDIDATE_ADD_BLOCKER_CODES } from './import-candidate-add-blocker.js';

const RECHECKABLE_MEDIA_REASON_CODE = 'audio_check_failed';

function isRecoverablePrerequisite(candidate) {
  if (candidate?.addBlockerCode === IMPORT_CANDIDATE_ADD_BLOCKER_CODES.SOURCE_PATH_UNAVAILABLE) {
    return 'folders';
  }

  if (candidate?.addBlockerCode === IMPORT_CANDIDATE_ADD_BLOCKER_CODES.MEDIA_VERIFICATION
    && candidate?.recoveryReasonCode === RECHECKABLE_MEDIA_REASON_CODE) {
    return 'media_tooling';
  }

  return null;
}

function buildResult({
  outcome,
  runId = null,
} = {}) {
  return {
    outcome,
    ...(runId ? { runId } : {}),
  };
}

function isExpectedApplyStartError(error) {
  return [
    'import_candidate_apply_in_progress',
    'import_candidate_apply_not_ready',
    'recovery_lock_conflict',
  ].includes(error?.code);
}

/**
 * Rechecks one release after an environmental prerequisite changes. This is
 * deliberately narrower than normal import apply: it never accepts a client
 * candidate id, it previews before reopening the candidate, and it reuses the
 * safe-auto quality gate before queueing a one-candidate operation run.
 */
export function createImportCandidateReleaseSafeAddRecheckService({
  findLatestReleaseAddRecoveryCandidate = async () => null,
  getImportCandidate = async () => null,
  getMediaToolingStatus = async () => ({ status: 'healthy' }),
  previewImportCandidateApply = async () => null,
  resumeImportCandidateForSafeAdd = async () => null,
  safeAutoAddQualityGateService = null,
  startImportCandidateApplyRun = async () => {
    throw new Error('startImportCandidateApplyRun dependency is required');
  },
} = {}) {
  if (typeof safeAutoAddQualityGateService?.evaluateSafeAutoAddQuality !== 'function') {
    throw new TypeError('createImportCandidateReleaseSafeAddRecheckService requires safeAutoAddQualityGateService');
  }

  async function recheckReleaseSafeAdd({
    actorUserId = null,
    appUserId,
    requestMetadata = null,
    wantedReleaseId,
  } = {}) {
    const recoveryCandidate = await findLatestReleaseAddRecoveryCandidate({
      appUserId,
      wantedReleaseId,
    });
    const prerequisite = isRecoverablePrerequisite(recoveryCandidate);
    if (!recoveryCandidate || !prerequisite) {
      return buildResult({ outcome: 'not_available' });
    }

    if (prerequisite === 'media_tooling') {
      const mediaTooling = await getMediaToolingStatus();
      if (mediaTooling?.status !== 'healthy') {
        return buildResult({ outcome: 'prerequisite_not_ready' });
      }
    }

    const importCandidate = await getImportCandidate({
      importCandidateId: recoveryCandidate.importCandidateId,
    });
    if (!importCandidate || importCandidate.status !== 'failed') {
      return buildResult({ outcome: 'not_available' });
    }

    const applyPreview = await previewImportCandidateApply({
      importCandidateId: importCandidate.id,
    });
    if (applyPreview?.summary?.status !== 'ready') {
      return buildResult({ outcome: 'still_needs_review' });
    }

    const qualityGate = await safeAutoAddQualityGateService.evaluateSafeAutoAddQuality({
      applyPreview,
      summaryCandidate: importCandidate,
    });
    if (!qualityGate?.eligible) {
      return buildResult({ outcome: 'still_needs_review' });
    }

    const resumed = await resumeImportCandidateForSafeAdd({
      actorUserId,
      importCandidateId: importCandidate.id,
      reason: 'Automatic library add resumed after prerequisite repair',
      requestMetadata,
    });
    if (!resumed?.candidate) {
      return buildResult({ outcome: 'not_available' });
    }

    try {
      const started = await startImportCandidateApplyRun({
        applySafetyMode: 'safe_auto',
        importCandidateIds: [importCandidate.id],
        requestMetadata,
        triggeredByUserId: actorUserId,
        triggerSource: 'music_queue_prerequisite_recheck',
      });

      return buildResult({
        outcome: 'queued',
        runId: started?.run?.id ?? null,
      });
    } catch (error) {
      if (isExpectedApplyStartError(error)) {
        return buildResult({ outcome: 'deferred' });
      }
      throw error;
    }
  }

  return {
    recheckReleaseSafeAdd,
  };
}
