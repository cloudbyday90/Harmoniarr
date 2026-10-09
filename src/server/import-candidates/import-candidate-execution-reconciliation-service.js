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

import { isUnconfirmedExecutionItem } from './import-candidate-execution-handoff-state.js';
import { mergeExecutionObservationRuns } from './import-execution-observation-policy.js';
import { hasPersistedMusicQueueOwnership } from './import-candidate-music-queue-auto-safe-add-policy.js';
import { matchesAcceptedRecoveryProvenance } from './music-queue-recovery-policy.js';
import {
  buildPersistedExecutionMissingTransferState,
  buildPersistedExecutionTransferSnapshot,
} from './import-candidate-execution-transfer-snapshot.js';

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
  return Boolean(item?.liveTransferSummary?.status) || item.downloadReviewRequired === true;
}

function buildUpdatedPlanningSnapshot(item, checkedAt) {
  if (!shouldPersistExecutionState(item)) {
    return item?.planningSnapshot ?? null;
  }

  const execution = item?.planningSnapshot?.execution ?? {};
  if (item.downloadReviewRequired === true) return { ...item.planningSnapshot,
    execution: { ...execution, downloadReviewRequired: true, confirmationCheckedAt: checkedAt } };

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
      downloadReviewRequired: false,
    },
  };
}


export function createImportCandidateExecutionReconciliationService({
  buildImportCandidateExecutionSummary = async () => ({ currentRun: null }),
  getImportCandidate = async () => null,
  confirmDownloadHandoff = null,
  closeAbandonedPreparation = async () => ({ closed: false }),
  ownsRecoveryCandidate = ({ candidate }) => hasPersistedMusicQueueOwnership(candidate),
  isCurrentExecutionObservation = async () => true,
  recordAcceptedCandidateObservation = async () => {},
  transitionOwnedExecutionCandidate = null,
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
    const currentRun = executionSummary.currentRun;
    const runs = mergeExecutionObservationRuns([currentRun, ...(executionSummary.unconfirmedRuns ?? []), ...(executionSummary.restoredRuns ?? [])]);
    let snapshotsUpdated = 0;
    let preparationsClosed = 0;
    const retries = [];
    const transitions = [];
    const recoveries = [];
    const rediscoveries = [];
    const autoApplyRuns = [];

    const runItems = runs.flatMap((run) => (run.items ?? []).map((item) => ({ run, item })));
    for (const { run, item } of runItems) {
      const importCandidateId = item?.planningSnapshot?.candidate?.id ?? item?.importCandidateId ?? null;

      const epoch = item.planningSnapshot?.execution?.handoff?.preProviderEpoch;
      if (epoch?.phase === 'preparing') {
        const closure = await closeAbandonedPreparation({ operationRunId: run.id, importCandidateId, expectedEpoch: epoch });
        if (closure.closed === true) { preparationsClosed += 1; continue; }
      }
      if (isUnconfirmedExecutionItem(item, run)) {
        if (typeof confirmDownloadHandoff !== 'function') throw new TypeError('The download confirmation owner is required');
        const attempt = item.planningSnapshot?.execution?.handoff?.attempt;
        const receipt = await confirmDownloadHandoff({ importCandidateId, operationRunId: run.id,
          attemptId: attempt?.attemptId ?? null, expectedAttempt: attempt, actorUserId, requestMetadata,
          ...(item.handoffConfirmation?.providerEvidence !== undefined ? { providerEvidence: item.handoffConfirmation.providerEvidence } : {}) });
        if (receipt.item && !receipt.alreadyConfirmed) snapshotsUpdated += 1;
        if (receipt.confirmed && receipt.phaseAdvanced) transitions.push({ fromStatus: 'selected', importCandidateId,
          liveTransferStatus: item.liveTransferSummary?.status ?? null, toStatus: receipt.candidate.status });
        if (receipt.definitiveFailure) {
          const candidate = receipt.candidate ?? await getImportCandidate({ importCandidateId });
          const scoped = await ownsRecoveryCandidate({ candidate, operationRunId: run.id });
          if (!scoped) await markImportCandidateDownloadFailed({ actorUserId, importCandidateId, reason: receipt.statusMessage, requestMetadata });
          const recovery = await handleImportCandidateDownloadFailure({ failedCandidateId: importCandidateId, operationRunId: run.id,
            failureReason: receipt.statusMessage, ...(scoped ? { observation: attempt.sourceObservation } : {}) });
          if (!recovery.episodeReplayed) {
            if (recovery.recovered) recoveries.push(recovery);
            else if (recovery.rediscovery?.scheduled) rediscoveries.push(recovery.rediscovery);
            recordActivityEventSafely(recordActivityEventFn, buildMusicQueueRecoveryActivityEvent({ candidate, operationRunId: run.id, recovery }));
          }
        }
        continue;
      }

      const targetStatus = resolveTransferAction(item);

      if (run?.id && importCandidateId && shouldPersistExecutionState(item)) {
        const updatedItem = await updateImportExecutionRunItem({
          importCandidateId,
          itemStatus: resolvePersistedExecutionItemStatus(item),
          operationRunId: run.id,
          planningSnapshot: buildUpdatedPlanningSnapshot(item, checkedAt),
          statusMessage: item.statusMessage,
        });
        if (updatedItem === null) continue;
        snapshotsUpdated += 1;
      }
      if (item.automaticFailureRecoveryAllowed === false && ['failed', 'retry_rejected'].includes(targetStatus)) continue;

      if (!importCandidateId || !targetStatus) {
        continue;
      }

      const candidate = await getImportCandidate({ importCandidateId });
      if (!candidate || candidate.status === targetStatus || !canTransition(candidate.status, targetStatus)) {
        continue;
      }

      const scopedObservation = await ownsRecoveryCandidate({ candidate, operationRunId: run?.id ?? null });
      const attemptOwned = item.planningSnapshot?.execution?.handoff?.attempt != null;
      const observation = item.planningSnapshot?.execution?.acceptedCandidateObservation
        ?? item.planningSnapshot?.execution?.handoff?.attempt?.sourceObservation
        ?? item.planningSnapshot?.execution?.sourceObservation ?? null;
      if ((attemptOwned || (scopedObservation && ['import_pending','downloading'].includes(targetStatus)))
        && (!matchesAcceptedRecoveryProvenance(candidate, observation)
          || !await isCurrentExecutionObservation({ candidateId: importCandidateId, operationRunId: run?.id ?? null }))) continue;
      const reason = item.liveTransferSummary?.message ?? item.statusMessage ?? null;
      let result = null;
      if (attemptOwned && ['downloading','import_pending'].includes(targetStatus) && typeof transitionOwnedExecutionCandidate !== 'function') {
        throw new TypeError('A current-source phase owner is required for attempt-owned transfer progress');
      }

      if (targetStatus === 'downloading') {
        result = (scopedObservation || attemptOwned) && typeof transitionOwnedExecutionCandidate === 'function'
          ? await transitionOwnedExecutionCandidate({ candidateId: importCandidateId, operationRunId: run.id,
            observation, targetStatus, reason }) : await markImportCandidateDownloading({
          actorUserId,
          importCandidateId,
          reason,
          requestMetadata,
        });
        if (scopedObservation && result?.candidate) await recordAcceptedCandidateObservation({ importCandidateId, operationRunId: run.id,
          observation: { ...observation, status: result.candidate.status,
            updatedAt: result.candidate.updatedAt?.toISOString?.() ?? result.candidate.updatedAt } });
      } else if (targetStatus === 'retry_rejected') {
        result = await handleImportCandidateRejectedTransfer({
          failedCandidateId: importCandidateId,
          failureReason: reason,
          operationRunId: run?.id ?? null,
          scheduleFollowUpRun: true,
          ...(scopedObservation ? { observation } : {}),
        });
        if (result?.episodeReplayed) continue;
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
        result = (scopedObservation || attemptOwned) && typeof transitionOwnedExecutionCandidate === 'function'
          ? await transitionOwnedExecutionCandidate({ candidateId: importCandidateId, operationRunId: run.id,
            observation, targetStatus, reason }) : await markImportCandidateImportPending({
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

        if (result?.candidate) recordActivityEventSafely(
          recordActivityEventFn,
          buildMusicQueueDownloadCompletedActivityEvent({
            candidate: result.candidate,
            operationRunId: run?.id ?? null,
          }),
        );

        if (typeof startSafeApplyRunAfterDownloadCompleted === 'function' && result?.candidate) {
          const autoApplyRun = await startSafeApplyRunAfterDownloadCompleted({
            importCandidateId,
            requestMetadata,
            ...(run?.id ? { operationRunId: run.id } : {}),
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
        if (!scopedObservation) result = await markImportCandidateDownloadFailed({ actorUserId, importCandidateId, reason, requestMetadata });
        const recovery = await handleImportCandidateDownloadFailure({
          failedCandidateId: importCandidateId,
          failureReason: reason,
          operationRunId: run?.id ?? null,
          scheduleFollowUpRun: run?.status !== 'pending' && run?.status !== 'running',
          terminalOutcome: item.liveTransferSummary?.terminalOutcome ?? undefined,
          ...(scopedObservation ? { observation } : {}),
        });
        if (recovery?.episodeReplayed) continue;
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
      currentRunId: currentRun?.id ?? null,
      summary: {
        autoApplySkipped: autoApplyRuns.filter((runResult) => runResult.started === false).length,
        autoApplyStarted: autoApplyRuns.filter((runResult) => runResult.started === true).length,
        recovered: recoveries.length,
        rediscovered: rediscoveries.length,
        retried: retries.length,
        snapshotsUpdated,
        ...(preparationsClosed > 0 ? { preparationsClosed } : {}),
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
