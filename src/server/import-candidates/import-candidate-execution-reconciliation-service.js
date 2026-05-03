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
  buildPersistedExecutionMissingTransferState,
  buildPersistedExecutionTransferSnapshot,
} from './import-candidate-execution-transfer-snapshot.js';

function resolveTargetStatus(item) {
  switch (item?.liveTransferSummary?.status) {
    case 'queued':
    case 'active':
      return 'downloading';
    case 'completed':
      return 'import_pending';
    case 'failed':
      return 'failed';
    case 'not_found':
      return item?.liveTransferSummary?.missingTransfer?.isPastGracePeriod ? 'failed' : null;
    default:
      return null;
  }
}

function canTransition(currentStatus, targetStatus) {
  switch (targetStatus) {
    case 'downloading':
      return currentStatus === 'selected';
    case 'import_pending':
    case 'failed':
      return currentStatus === 'selected' || currentStatus === 'downloading';
    default:
      return false;
  }
}

function shouldPersistExecutionState(item) {
  return Boolean(item?.liveTransferSummary?.status);
}

function buildUpdatedPlanningSnapshot(item, checkedAt) {
  if (!shouldPersistExecutionState(item)) {
    return item?.planningSnapshot ?? null;
  }

  const execution = item?.planningSnapshot?.execution ?? {};

  if (item.liveTransferSummary.status === 'not_found') {
    return {
      ...(item?.planningSnapshot ?? {}),
      execution: {
        ...execution,
        missingTransfer: buildPersistedExecutionMissingTransferState({
          checkedAt,
          liveTransferSummary: item.liveTransferSummary,
          previousMissingTransfer: execution.missingTransfer,
        }),
      },
    };
  }

  const persistedTransferSnapshot = buildPersistedExecutionTransferSnapshot({
    liveTransferSummary: item.liveTransferSummary,
    liveTransfers: item.liveTransfers,
    reconciledAt: checkedAt,
  });

  if (!persistedTransferSnapshot) {
    return item?.planningSnapshot ?? null;
  }

  return {
    ...(item?.planningSnapshot ?? {}),
    execution: {
      ...execution,
      latestTransferSnapshot: persistedTransferSnapshot,
      missingTransfer: null,
    },
  };
}

export function createImportCandidateExecutionReconciliationService({
  buildImportCandidateExecutionSummary = async () => ({ currentRun: null }),
  getImportCandidate = async () => null,
  markImportCandidateDownloadFailed = async () => null,
  markImportCandidateDownloading = async () => null,
  markImportCandidateImportPending = async () => null,
  updateImportExecutionRunItem = async () => null,
} = {}) {
  async function reconcileImportCandidateExecutionSummary({
    actorUserId = null,
    executionSummary = { currentRun: null },
    requestMetadata = null,
  } = {}) {
    const checkedAt = new Date().toISOString();
    const run = executionSummary.currentRun;
    const items = run?.items ?? [];
    let snapshotsUpdated = 0;
    const transitions = [];

    for (const item of items) {
      const importCandidateId = item?.planningSnapshot?.candidate?.id ?? item?.importCandidateId ?? null;
      const targetStatus = resolveTargetStatus(item);

      if (run?.id && importCandidateId && shouldPersistExecutionState(item)) {
        await updateImportExecutionRunItem({
          importCandidateId,
          itemStatus: item.itemStatus,
          operationRunId: run.id,
          planningSnapshot: buildUpdatedPlanningSnapshot(item, checkedAt),
          statusMessage: item.statusMessage,
        });
        snapshotsUpdated += 1;
      }

      if (!importCandidateId || !targetStatus) {
        continue;
      }

      const candidate = await getImportCandidate({ importCandidateId });
      if (!candidate || candidate.status === targetStatus || !canTransition(candidate.status, targetStatus)) {
        continue;
      }

      const reason = item.liveTransferSummary?.message ?? item.statusMessage ?? null;
      let result = null;

      if (targetStatus === 'downloading') {
        result = await markImportCandidateDownloading({
          actorUserId,
          importCandidateId,
          reason,
          requestMetadata,
        });
      } else if (targetStatus === 'import_pending') {
        result = await markImportCandidateImportPending({
          actorUserId,
          importCandidateId,
          reason,
          requestMetadata,
        });
      } else if (targetStatus === 'failed') {
        result = await markImportCandidateDownloadFailed({
          actorUserId,
          importCandidateId,
          reason,
          requestMetadata,
        });
      }

      if (result?.candidate) {
        transitions.push({
          fromStatus: candidate.status,
          importCandidateId,
          liveTransferStatus: item.liveTransferSummary?.status ?? null,
          toStatus: result.candidate.status,
        });
      }
    }

    return {
      checkedAt,
      currentRunId: run?.id ?? null,
      summary: {
        snapshotsUpdated,
        transitioned: transitions.length,
      },
      transitions,
    };
  }

  async function reconcileImportCandidateExecutionState({
    actorUserId = null,
    executionSummary = null,
    requestMetadata = null,
  } = {}) {
    const resolvedExecutionSummary = executionSummary ?? await buildImportCandidateExecutionSummary();
    return reconcileImportCandidateExecutionSummary({
      actorUserId,
      executionSummary: resolvedExecutionSummary,
      requestMetadata,
    });
  }

  return {
    reconcileImportCandidateExecutionSummary,
    reconcileImportCandidateExecutionState,
  };
}
