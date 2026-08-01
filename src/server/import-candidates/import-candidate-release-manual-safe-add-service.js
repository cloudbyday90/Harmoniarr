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

const EXPECTED_APPLY_START_ERROR_CODES = new Set([
  'import_candidate_apply_in_progress',
  'import_candidate_apply_not_ready',
  'recovery_lock_conflict',
]);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getCandidateWantedReleaseIds(candidate) {
  const normalizedPayload = candidate?.normalizedPayload;
  const contexts = [
    normalizedPayload?.musicQueue,
    normalizedPayload?.musicQueueContext,
  ].filter((context) => context && typeof context === 'object');

  return [...new Set(contexts.flatMap((context) => {
    const wantedReleaseIds = Array.isArray(context.wantedReleaseIds)
      ? context.wantedReleaseIds.map(normalizeString).filter(Boolean)
      : [];
    const wantedReleaseId = normalizeString(
      context.wantedReleaseId ?? context.qualityOverride?.wantedReleaseId,
    );

    return [
      ...(wantedReleaseId ? [wantedReleaseId] : []),
      ...wantedReleaseIds,
    ];
  }))];
}

function buildResult({ outcome, runId = null } = {}) {
  return {
    outcome,
    ...(runId ? { runId } : {}),
  };
}

/**
 * Starts a one-release safe add only after regenerating the file plan and
 * strict quality evidence. The caller obtains the candidate ID from the
 * already-authorized Music Queue release; this service verifies that the
 * candidate still belongs to that release before it can enqueue any work.
 */
export function createImportCandidateReleaseManualSafeAddService({
  getImportCandidate = async () => null,
  previewImportCandidateApply = async () => null,
  safeAutoAddQualityGateService = null,
  startImportCandidateApplyRun = async () => {
    throw new Error('startImportCandidateApplyRun dependency is required');
  },
} = {}) {
  if (typeof safeAutoAddQualityGateService?.evaluateSafeAutoAddQuality !== 'function') {
    throw new TypeError('createImportCandidateReleaseManualSafeAddService requires safeAutoAddQualityGateService');
  }

  async function startReleaseManualSafeAdd({
    actorUserId = null,
    appUserId,
    importCandidateId,
    requestMetadata = null,
    wantedReleaseId,
  } = {}) {
    const scopedAppUserId = normalizeString(appUserId);
    const scopedCandidateId = normalizeString(importCandidateId);
    const scopedWantedReleaseId = normalizeString(wantedReleaseId);
    if (!scopedAppUserId || !scopedCandidateId || !scopedWantedReleaseId) {
      return buildResult({ outcome: 'not_available' });
    }

    const candidate = await getImportCandidate({ importCandidateId: scopedCandidateId });
    if (candidate?.status !== 'import_pending'
      || !getCandidateWantedReleaseIds(candidate).includes(scopedWantedReleaseId)) {
      return buildResult({ outcome: 'not_available' });
    }

    const applyPreview = await previewImportCandidateApply({
      importCandidateId: candidate.id,
    });
    if (applyPreview?.summary?.status !== 'ready') {
      return buildResult({ outcome: 'still_needs_review' });
    }

    const qualityGate = await safeAutoAddQualityGateService.evaluateSafeAutoAddQuality({
      applyPreview,
      summaryCandidate: candidate,
    });
    if (!qualityGate?.eligible) {
      return buildResult({ outcome: 'still_needs_review' });
    }

    try {
      const started = await startImportCandidateApplyRun({
        applySafetyMode: 'safe_auto',
        importCandidateIds: [candidate.id],
        requestMetadata,
        triggeredByUserId: actorUserId,
        triggerSource: 'music_queue_manual_add',
      });
      return buildResult({
        outcome: 'queued',
        runId: started?.run?.id ?? null,
      });
    } catch (error) {
      if (EXPECTED_APPLY_START_ERROR_CODES.has(error?.code)) {
        return buildResult({ outcome: 'deferred' });
      }
      throw error;
    }
  }

  return {
    startReleaseManualSafeAdd,
  };
}
