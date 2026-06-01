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

import { operationRunRegistry } from '../shared/operation-run-descriptors.js';

export const defaultOperationQueueDispatchOperationTypes = Object.freeze([
  operationRunRegistry.artworkCleanup.operationType,
  operationRunRegistry.importCandidateExecutionPlanning.operationType,
  operationRunRegistry.importCandidateApply.operationType,
  operationRunRegistry.importCandidateMediaInspection.operationType,
  operationRunRegistry.importCandidateTranscodeOrchestration.operationType,
  operationRunRegistry.libraryDiscoveryDispatch.operationType,
  operationRunRegistry.libraryExternalIntakePlanning.operationType,
  operationRunRegistry.libraryExternalIntakeExecution.operationType,
  operationRunRegistry.libraryOrganizeApply.operationType,
  operationRunRegistry.libraryScan.operationType,
  operationRunRegistry.metadataArtistRefresh.operationType,
  operationRunRegistry.operatorArtistReconciliation.operationType,
  operationRunRegistry.operatorNotificationFanout.operationType,
]);

function toNumberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

export function createOperationQueueHandlers({
  artworkModule = null,
  importCandidateModule = null,
  libraryModule = null,
  metadataModule = null,
  systemModule = null,
} = {}) {
  const handlers = {};

  if (artworkModule?.artworkCleanupWorker?.startWorkerRun) {
    handlers[operationRunRegistry.artworkCleanup.operationType] = async ({ run }) => artworkModule.artworkCleanupWorker.startWorkerRun({
      requestedAssetCount: toNumberOrNull(run.summary.requestedAssetCount),
      retentionCutoff: run.summary.retentionCutoff ?? null,
      runId: run.id,
    });
  }

  if (importCandidateModule?.importCandidateExecutionWorker?.startWorkerRun) {
    handlers[operationRunRegistry.importCandidateExecutionPlanning.operationType] = async ({ run }) => importCandidateModule.importCandidateExecutionWorker.startWorkerRun({
      requestedCandidateCount: toNumberOrNull(run.summary.requestedCandidateCount),
      runId: run.id,
    });
  }

  if (importCandidateModule?.importCandidateApplyWorker?.startWorkerRun) {
    handlers[operationRunRegistry.importCandidateApply.operationType] = async ({ run }) => importCandidateModule.importCandidateApplyWorker.startWorkerRun({
      executableCandidateCount: toNumberOrNull(run.summary.executableCandidateCount),
      requestedCandidateCount: toNumberOrNull(run.summary.requestedCandidateCount),
      runId: run.id,
    });
  }

  if (importCandidateModule?.importCandidateMediaInspectionWorker?.startWorkerRun) {
    handlers[operationRunRegistry.importCandidateMediaInspection.operationType] = async ({ run }) => importCandidateModule.importCandidateMediaInspectionWorker.startWorkerRun({
      requestedCandidateCount: toNumberOrNull(run.summary.requestedCandidateCount),
      runId: run.id,
    });
  }

  if (importCandidateModule?.importCandidateTranscodeWorker?.startWorkerRun) {
    handlers[operationRunRegistry.importCandidateTranscodeOrchestration.operationType] = async ({ run }) => importCandidateModule.importCandidateTranscodeWorker.startWorkerRun({
      requestedCandidateCount: toNumberOrNull(run.summary.requestedCandidateCount),
      runId: run.id,
      transcodeCandidateFileCount: toNumberOrNull(run.summary.transcodeCandidateFileCount),
    });
  }

  if (libraryModule?.libraryDiscoveryWorker?.startWorkerRun) {
    handlers[operationRunRegistry.libraryDiscoveryDispatch.operationType] = async ({ run }) => libraryModule.libraryDiscoveryWorker.startWorkerRun({
      runId: run.id,
      triggerSource: run.summary.triggerSource ?? 'manual',
      triggeredByUserId: run.triggeredByUserId ?? null,
    });
  }

  if (libraryModule?.libraryExternalIntakeWorker?.startWorkerRun) {
    handlers[operationRunRegistry.libraryExternalIntakePlanning.operationType] = async ({ run }) => libraryModule.libraryExternalIntakeWorker.startWorkerRun({
      canonicalUrl: run.summary.canonicalUrl ?? null,
      mediaRequestId: run.summary.mediaRequestId ?? null,
      resourceType: run.summary.resourceType ?? null,
      runId: run.id,
      sourceIdentifier: run.summary.sourceIdentifier ?? null,
      sourceProvider: run.summary.sourceProvider ?? null,
      triggerSource: run.summary.triggerSource ?? 'request_submit',
      triggeredByUserId: run.triggeredByUserId ?? null,
    });
  }

  if (libraryModule?.libraryProviderIngestExecutionWorker?.startWorkerRun) {
    handlers[operationRunRegistry.libraryExternalIntakeExecution.operationType] = async ({ run }) => libraryModule.libraryProviderIngestExecutionWorker.startWorkerRun({
      canonicalUrl: run.summary.canonicalUrl ?? null,
      mediaRequestId: run.summary.mediaRequestId ?? null,
      resourceType: run.summary.resourceType ?? null,
      runId: run.id,
      sourceIdentifier: run.summary.sourceIdentifier ?? null,
      sourceProvider: run.summary.sourceProvider ?? null,
      triggerSource: run.summary.triggerSource ?? 'planning_complete',
      triggeredByUserId: run.triggeredByUserId ?? null,
    });
  }

  if (libraryModule?.libraryScanWorker?.startWorkerRun) {
    handlers[operationRunRegistry.libraryScan.operationType] = async ({ run }) => libraryModule.libraryScanWorker.startWorkerRun({
      libraryRoot: run.summary.libraryRoot ?? null,
      releaseHints: Array.isArray(run.summary.releaseHints) ? run.summary.releaseHints : [],
      runId: run.id,
      triggeredByRunId: run.summary.triggeredByRunId ?? null,
      triggerReason: run.summary.triggerReason ?? null,
    });
  }

  if (libraryModule?.libraryOrganizeApplyWorker?.startWorkerRun) {
    handlers[operationRunRegistry.libraryOrganizeApply.operationType] = async ({ run }) => libraryModule.libraryOrganizeApplyWorker.startWorkerRun({
      plannedRenameCount: toNumberOrNull(run.summary.plannedRenameCount),
      runId: run.id,
    });
  }

  if (metadataModule?.metadataArtistRefreshWorker?.startWorkerRun) {
    handlers[operationRunRegistry.metadataArtistRefresh.operationType] = async ({ run }) => metadataModule.metadataArtistRefreshWorker.startWorkerRun({
      artistName: run.summary.artistName ?? null,
      metadataArtistId: run.summary.metadataArtistId ?? null,
      musicBrainzArtistId: run.summary.musicBrainzArtistId ?? null,
      runId: run.id,
      triggerSource: run.summary.triggerSource ?? 'manual',
    });
  }

  if (metadataModule?.operatorArtistReconciliationWorker?.startWorkerRun) {
    handlers[operationRunRegistry.operatorArtistReconciliation.operationType] = async ({ run }) => metadataModule.operatorArtistReconciliationWorker.startWorkerRun({
      appUserId: run.summary.appUserId ?? null,
      artistName: run.summary.artistName ?? null,
      metadataArtistId: run.summary.metadataArtistId ?? null,
      runId: run.id,
      snapshotId: run.summary.snapshotId ?? null,
      snapshotRevision: toNumberOrNull(run.summary.snapshotRevision),
      triggerSource: run.summary.triggerSource ?? 'save',
    });
  }

  if (systemModule?.operatorNotificationFanoutWorker?.startWorkerRun) {
    handlers[operationRunRegistry.operatorNotificationFanout.operationType] = async ({ run }) => systemModule.operatorNotificationFanoutWorker.startWorkerRun({
      notificationDedupeKeys: Array.isArray(run.summary?.notificationDedupeKeys)
        ? run.summary.notificationDedupeKeys
        : null,
      runId: run.id,
    });
  }

  return handlers;
}
