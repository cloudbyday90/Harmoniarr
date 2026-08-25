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
import { buildDownloadAcceptanceDiagnostic, buildDownloadHandoffConfirmationDiagnostic } from './import-candidate-execution-diagnostics.js';
import {
  buildMusicQueueRecoveryActivityEvent,
  recordActivityEventSafely,
} from '../activity/music-queue-lifecycle-activity-event-service.js';
import { buildMusicQueueDownloadCompletedActivityEvent } from '../activity/music-queue-milestone-activity-event-service.js';

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

function resolveTransferAction(item) {
  if (item?.liveTransferSummary?.status === 'rejected') {
    return 'retry_rejected';
  }

  return resolveTargetStatus(item);
}

function resolvePersistedExecutionItemStatus(item) {
  switch (item?.liveTransferSummary?.status) {
    case 'active':
      return 'downloading';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'rejected':
      return 'rejected';
    case 'not_found':
      return 'missing';
    default:
      return item?.itemStatus ?? 'queued';
  }
}

function canTransition(currentStatus, targetStatus) {
  switch (targetStatus) {
    case 'downloading':
      return currentStatus === 'selected';
    case 'retry_rejected':
      return currentStatus === 'downloading';
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
  handleImportCandidateDownloadFailure = async () => ({ recovered: false }),
  handleImportCandidateRejectedTransfer = async () => ({ recovered: false }),
  onDownloadCompletedFn = null,
  recordActivityEventFn = null,
  startSafeApplyRunAfterDownloadCompleted = null,
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
    const retries = [];
    const transitions = [];
    const recoveries = [];
    const rediscoveries = [];
    const autoApplyRuns = [];

    for (const item of items) {
      const importCandidateId = item?.planningSnapshot?.candidate?.id ?? item?.importCandidateId ?? null;

      if (hasUnconfirmedDownloadHandoff(item)) {
        const confirmation = item.handoffConfirmation;
        const confirmed = confirmation.allRequestedFilesMatched === true;
        const handoffMessage = confirmed
          ? `${confirmation.matchedTransfers.length} file${confirmation.matchedTransfers.length === 1 ? '' : 's'} confirmed in slskd after an interrupted download request.`
          : 'Confirming whether slskd accepted the earlier download request before sending anything else.';

        if (run?.id && importCandidateId) {
          await updateImportExecutionRunItem({
            importCandidateId,
            itemStatus: confirmed ? 'queued' : 'awaiting_confirmation',
            operationRunId: run.id,
            planningSnapshot: confirmed
              ? buildConfirmedDownloadHandoffSnapshot(item, checkedAt)
              : buildPendingDownloadHandoffSnapshot(item, checkedAt),
            statusMessage: handoffMessage,
          });
          snapshotsUpdated += 1;
        }

        if (confirmed && importCandidateId) {
          const candidate = await getImportCandidate({ importCandidateId });
          if (candidate?.status === 'selected') {
            const result = await markImportCandidateDownloading({
              actorUserId,
              importCandidateId,
              reason: handoffMessage,
              requestMetadata,
            });
            if (result?.candidate) {
              transitions.push({
                fromStatus: candidate.status,
                importCandidateId,
                liveTransferStatus: item.liveTransferSummary?.status ?? null,
                toStatus: result.candidate.status,
              });
            }
          }
        }
        continue;
      }

      const targetStatus = resolveTransferAction(item);

      if (run?.id && importCandidateId && shouldPersistExecutionState(item)) {
        await updateImportExecutionRunItem({
          importCandidateId,
          itemStatus: resolvePersistedExecutionItemStatus(item),
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
      } else if (targetStatus === 'retry_rejected') {
        result = await handleImportCandidateRejectedTransfer({
          failedCandidateId: importCandidateId,
          failureReason: reason,
          operationRunId: run?.id ?? null,
          scheduleFollowUpRun: true,
        });
        if (result?.retrySameCandidate) {
          retries.push(result);
        } else if (result?.recovered) {
          recoveries.push(result);
        } else if (result?.rediscovery?.scheduled) {
          rediscoveries.push(result.rediscovery);
        }
        recordActivityEventSafely(
          recordActivityEventFn,
          buildMusicQueueRecoveryActivityEvent({
            candidate,
            operationRunId: run?.id ?? null,
            recovery: result,
          }),
        );
      } else if (targetStatus === 'import_pending') {
        result = await markImportCandidateImportPending({
          actorUserId,
          importCandidateId,
          reason,
          requestMetadata,
        });

        if (typeof onDownloadCompletedFn === 'function' && result?.candidate) {
          void onDownloadCompletedFn({
            importCandidateId,
            username: result.candidate.username ?? null,
            folderPath: result.candidate.folderPath ?? null,
          }).catch(() => {});
        }

        recordActivityEventSafely(
          recordActivityEventFn,
          buildMusicQueueDownloadCompletedActivityEvent({
            candidate: result?.candidate ?? candidate,
            operationRunId: run?.id ?? null,
          }),
        );

        if (typeof startSafeApplyRunAfterDownloadCompleted === 'function' && result?.candidate) {
          const autoApplyRun = await startSafeApplyRunAfterDownloadCompleted({
            importCandidateId,
            requestMetadata,
          });
          autoApplyRuns.push(autoApplyRun);

          if (autoApplyRun?.recovery?.recovered) {
            recoveries.push(autoApplyRun.recovery);
          } else if (autoApplyRun?.recovery?.rediscovery?.scheduled) {
            rediscoveries.push(autoApplyRun.recovery.rediscovery);
          }

          if (autoApplyRun?.recovery) {
            recordActivityEventSafely(
              recordActivityEventFn,
              buildMusicQueueRecoveryActivityEvent({
                candidate: result.candidate,
                operationRunId: run?.id ?? null,
                recovery: autoApplyRun.recovery,
              }),
            );
          }
        }
      } else if (targetStatus === 'failed') {
        result = await markImportCandidateDownloadFailed({
          actorUserId,
          importCandidateId,
          reason,
          requestMetadata,
        });
        const recovery = await handleImportCandidateDownloadFailure({
          failedCandidateId: importCandidateId,
          failureReason: reason,
          operationRunId: run?.id ?? null,
          scheduleFollowUpRun: run?.status !== 'pending' && run?.status !== 'running',
          terminalOutcome: item.liveTransferSummary?.terminalOutcome ?? undefined,
        });
        if (recovery?.recovered) {
          recoveries.push(recovery);
        } else if (recovery?.rediscovery?.scheduled) {
          rediscoveries.push(recovery.rediscovery);
        }
        recordActivityEventSafely(
          recordActivityEventFn,
          buildMusicQueueRecoveryActivityEvent({
            candidate,
            operationRunId: run?.id ?? null,
            recovery,
          }),
        );
      }

      if (result?.candidate) {
        transitions.push({
          fromStatus: candidate.status,
          importCandidateId,
          liveTransferStatus: item.liveTransferSummary?.status ?? null,
          toStatus: result.candidate.status,
        });
      } else if (targetStatus === 'retry_rejected' && result?.retrySameCandidate) {
        transitions.push({
          fromStatus: candidate.status,
          importCandidateId,
          liveTransferStatus: item.liveTransferSummary?.status ?? null,
          toStatus: 'selected',
        });
      }
    }

    return {
      checkedAt,
      currentRunId: run?.id ?? null,
      summary: {
        autoApplySkipped: autoApplyRuns.filter((runResult) => runResult.started === false).length,
        autoApplyStarted: autoApplyRuns.filter((runResult) => runResult.started === true).length,
        recovered: recoveries.length,
        rediscovered: rediscoveries.length,
        retried: retries.length,
        snapshotsUpdated,
        transitioned: transitions.length,
      },
      transitions,
      recoveries,
      rediscoveries,
      retries,
      autoApplyRuns,
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

function hasUnconfirmedDownloadHandoff(item) {
  const state = item?.planningSnapshot?.execution?.handoff?.state;
  return (state === 'dispatching' || state === 'awaiting_confirmation')
    && Boolean(item?.handoffConfirmation);
}

function buildConfirmedDownloadHandoffSnapshot(item, checkedAt) {
  const execution = item?.planningSnapshot?.execution ?? {};
  const confirmation = item?.handoffConfirmation ?? {};
  const requestedFiles = Array.isArray(execution.requestedFiles) ? execution.requestedFiles : [];
  const enqueueResult = {
    enqueued: confirmation.matchedTransfers ?? [],
    failed: [],
  };

  return {
    ...(item?.planningSnapshot ?? {}),
    execution: {
      ...execution,
      diagnostics: {
        ...execution.diagnostics,
        downloadAcceptance: buildDownloadAcceptanceDiagnostic({
          enqueueResult,
          requestedFiles,
        }),
      },
      enqueuedTransfers: enqueueResult.enqueued,
      handoff: {
        ...execution.handoff,
        confirmedAt: checkedAt,
        state: 'confirmed',
      },
      outcome: 'queued',
    },
  };
}

function buildPendingDownloadHandoffSnapshot(item, checkedAt) {
  const execution = item?.planningSnapshot?.execution ?? {};
  const confirmation = item?.handoffConfirmation ?? {};
  const requestedFiles = Array.isArray(execution.requestedFiles) ? execution.requestedFiles : [];

  return {
    ...(item?.planningSnapshot ?? {}),
    execution: {
      ...execution,
      diagnostics: {
        ...execution.diagnostics,
        downloadAcceptance: buildDownloadHandoffConfirmationDiagnostic({
          matchedTransferCount: confirmation.matchedTransfers?.length ?? 0,
          requestedFileCount: confirmation.requestedFileCount ?? requestedFiles.length,
        }),
      },
      handoff: {
        ...execution.handoff,
        lastConfirmedAt: checkedAt,
        state: 'awaiting_confirmation',
      },
    },
  };
}
