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

import { captureRecoveryObservation } from './music-queue-recovery-policy.js';
import { createApiError } from '../auth.js';
import { preProviderRefusalReason } from './import-execution-pre-provider-policy.js';
import { hasPersistedMusicQueueOwnership } from './import-candidate-music-queue-auto-safe-add-policy.js';
import { createOperationRunLeaseHeartbeat } from '../heartbeat/operation-run-lease-heartbeat.js';
import {
  isOperationRunCancellationError,
  isOperationRunPauseError,
  throwIfOperationRunCancellationRequested,
} from '../operation-run-cancellation.js';
import {
  buildNoUnlockedFilesDiagnostic,
  buildPlanningBlockedDiagnostic,
} from './import-candidate-execution-diagnostics.js';
import {
  buildMusicQueueRecoveryActivityEvent,
  recordActivityEventSafely,
} from '../activity/music-queue-lifecycle-activity-event-service.js';
import { buildMusicQueueDownloadStartedActivityEvent } from '../activity/music-queue-milestone-activity-event-service.js';

function normalizeRemoteFilename(file) {
  const rawFilename = typeof file?.rawPayload?.filename === 'string'
    ? file.rawPayload.filename.trim()
    : '';
  if (rawFilename) {
    return rawFilename;
  }

  const folderPath = typeof file?.folderPath === 'string'
    ? file.folderPath.trim().replaceAll('/', '\\')
    : '';
  const filename = typeof file?.filename === 'string' ? file.filename.trim() : '';
  if (!filename) {
    return '';
  }

  return folderPath ? `${folderPath}\\${filename}` : filename;
}

function buildEnqueueRequests(files) {
  return files.flatMap((file) => {
    const filename = normalizeRemoteFilename(file);
    if (!filename) {
      return [];
    }

    return [{
      filename,
      size: file.sizeBytes ?? 0,
    }];
  });
}

function buildRunTriggerSummary({
  selectedCandidateId = null,
  sourceSearchId = null,
  triggerSource = null,
} = {}) {
  return Object.fromEntries(Object.entries({
    selectedCandidateId,
    sourceSearchId,
    triggerSource,
  }).filter(([, value]) => value !== null && value !== undefined));
}

function hasUnconfirmedDownloadHandoff(item) {
  const state = item?.planningSnapshot?.execution?.handoff?.state;
  return state === 'dispatching' || state === 'awaiting_confirmation'
    || (state === 'confirmed' && item?.planningSnapshot?.execution?.enqueuedTransfers?.length > 0);
}

function hasCurrentWorkerLease(current, acquired) {
  return typeof acquired?.ownerInstanceId === 'string' && Boolean(acquired.ownerInstanceId.trim())
    && typeof acquired.acquiredAt === 'string' && Number.isFinite(Date.parse(acquired.acquiredAt))
    && current?.ownerInstanceId === acquired.ownerInstanceId && current.acquiredAt === acquired.acquiredAt
    && !current.releasedAt && current.state === 'active' && current.status === 'active'
    && Number.isFinite(Date.parse(current.expiresAt)) && Date.parse(current.expiresAt) > Date.now();
}

export function createImportCandidateExecutionWorker({
  acquireLease,
  buildSelectedImportCandidateSummary = async () => ({
    counts: {
      blocked: 0,
      ready: 0,
      readyWithWarnings: 0,
      totalSelected: 0,
    },
    selectedCandidates: [],
  }),
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  enqueueDownloads = async () => ({
    enqueued: [],
    failed: [],
  }),
  prepareDownloadDispatch = null,
  findMatchingTransfers = null,
  getImportCandidate = async () => null,
  prepareDownloadHandoff = null,
  confirmDownloadHandoff = null,
  assertDownloadHandoffCurrent = null,
  recordDownloadHandoffNotDispatched = null,
  beginPreparation = null,
  refusePreparation = null,
  markDispatchPossible = null,
  getLease = null,
  ownsRecoveryCandidate = ({ candidate }) => hasPersistedMusicQueueOwnership(candidate),
  resolveRecoveryExecution = async () => null,
  assertRecoveryExecutionCurrent = async () => {},
  retireRecoveryExecution = async () => {},
  handleImportCandidateDownloadFailure = async () => ({ recovered: false }),
  isCancellationRequested,
  markRunPaused,
  markImportCandidateDownloadFailed = async () => null,
  markRunCompleted,
  markRunCancelled,
  markRunFailed,
  markRunStarted,
  recordActivityEventFn = null,
  releaseLease,
  listImportExecutionRunItems = async () => [],
  renewLease,
  initializeImportExecutionRunItems = async () => [],
  updateImportExecutionRunItem = async () => null,
  upsertImportExecutionRunItem = async () => null,
} = {}) {
  if (beginPreparation != null && [refusePreparation, markDispatchPossible].some((fn) => typeof fn !== 'function')) {
    throw new TypeError('Tracked download preparation requires its refusal and dispatch owners');
  }
  const activeRunIds = new Set();

  function buildRunItems(selectedCandidates, { startPosition = 1 } = {}) {
    return selectedCandidates.map((candidate, index) => ({
      importCandidateId: candidate.id,
      itemStatus: candidate.executionStatus.code,
      planningSnapshot: {
          candidate: {
            downloadAttemptCount: candidate.downloadAttemptCount ?? 0,
            fileCount: candidate.fileCount,
            folderPath: candidate.folderPath,
            id: candidate.id,
            lockedFileCount: candidate.lockedFileCount,
            selectedAt: candidate.selectedAt,
            selectionReason: candidate.selectionReason ?? null,
            sourceProvider: candidate.sourceProvider,
            sourceSearchId: candidate.sourceSearchId,
          totalSizeBytes: candidate.totalSizeBytes,
          username: candidate.username,
        },
        planning: candidate.planning,
      },
      position: startPosition + index,
      statusMessage: candidate.executionStatus.message,
    }));
  }

  async function runExecution({
    requestedCandidateCount,
    runId,
    selectedCandidateId = null,
    sourceSearchId = null,
    triggerSource = null,
  }) {
    let finalLeaseStatus = 'completed';
    let leaseAcquired = false;
    let acquiredLease;
    let leaseHeartbeat = null;
    const triggerSummary = buildRunTriggerSummary({
      selectedCandidateId,
      sourceSearchId,
      triggerSource,
    });

    try {
      acquiredLease = await acquireLease({ runId });
      leaseAcquired = true;
      if (renewLease) {
        leaseHeartbeat = createOperationRunLeaseHeartbeatFn({ renewLease, runId });
        leaseHeartbeat.start();
      }
      await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });
      await markRunStarted({
        runId,
        summary: {
          currentStep: 'Resolving selected candidate download requests',
          executionMode: 'download_enqueue',
          requestedCandidateCount,
          ...triggerSummary,
        },
      });

      const selectedSummary = await buildSelectedImportCandidateSummary({
        ...(selectedCandidateId ? { candidateIds: [selectedCandidateId] } : {}),
        limit: 1000,
      });
      const candidateQueue = [...(selectedSummary.selectedCandidates ?? [])];
      const existingRunItems = await listImportExecutionRunItems(runId);
      const persistedItemsByCandidateId = new Map(existingRunItems.map((item) => [
        item.importCandidateId,
        item,
      ]));
      const runItems = existingRunItems.length > 0 ? existingRunItems : buildRunItems(candidateQueue);

      if (existingRunItems.length === 0) {
        const initialized = await initializeImportExecutionRunItems(runId, runItems);
        for (const item of initialized) persistedItemsByCandidateId.set(item.importCandidateId, item);
      } else {
        let nextPosition = existingRunItems.reduce((highestPosition, item) => (
          Math.max(highestPosition, item.position ?? 0)
        ), 0) + 1;

        for (const candidate of candidateQueue) {
          if (persistedItemsByCandidateId.has(candidate.id)) {
            continue;
          }

          const [runItem] = buildRunItems([candidate], { startPosition: nextPosition });
          nextPosition += 1;
          await upsertImportExecutionRunItem({
            ...runItem,
            operationRunId: runId,
          });
          persistedItemsByCandidateId.set(candidate.id, runItem);
        }
      }

      const counts = {
        blocked: 0,
        queueFailed: 0,
        queued: 0,
        queuedWithWarnings: 0,
        recovered: 0,
        awaitingConfirmation: 0,
      };
      const processedCandidateIds = new Set();

      async function appendRecoveryCandidate(recoveryResult) {
        if (recoveryResult?.scopedRecoveryQueued || recoveryResult?.episodeReplayed || !recoveryResult?.recovered || !recoveryResult.nextCandidateId) {
          return null;
        }

        if (processedCandidateIds.has(recoveryResult.nextCandidateId)
          || candidateQueue.some((candidate) => candidate.id === recoveryResult.nextCandidateId)) {
          return null;
        }

        const refreshedSummary = await buildSelectedImportCandidateSummary({ limit: 1000 });
        const recoveryCandidate = (refreshedSummary.selectedCandidates ?? [])
          .find((candidate) => candidate.id === recoveryResult.nextCandidateId);

        if (!recoveryCandidate) {
          return null;
        }

        const [runItem] = buildRunItems([recoveryCandidate], {
          startPosition: candidateQueue.length + 1,
        });
        await upsertImportExecutionRunItem({
          ...runItem,
          operationRunId: runId,
        });
        candidateQueue.push(recoveryCandidate);
        counts.recovered += 1;
        return recoveryCandidate;
      }

      async function consumeReceipt({ receipt, candidate, summaryCandidate, sourceObservation }) {
        if (receipt.confirmed) {
          if (summaryCandidate.executionStatus.code === 'ready_with_warnings') counts.queuedWithWarnings += 1;
          else counts.queued += 1;
          if (!receipt.alreadyConfirmed && receipt.phaseAdvanced) recordActivityEventSafely(recordActivityEventFn,
            buildMusicQueueDownloadStartedActivityEvent({ candidate: summaryCandidate, operationRunId: runId,
              queuedFileCount: receipt.requestedFileCount, queuedWithWarnings: summaryCandidate.executionStatus.code === 'ready_with_warnings' }));
          return;
        }
        if (!receipt.definitiveFailure) { counts.awaitingConfirmation += 1; return; }
        counts.queueFailed += 1;
        const scoped = await ownsRecoveryCandidate({ candidate, operationRunId: runId });
        if (!scoped) await markImportCandidateDownloadFailed({ importCandidateId: candidate.id, reason: receipt.statusMessage });
        const recovery = await handleImportCandidateDownloadFailure({ failedCandidateId: candidate.id, failureReason: receipt.statusMessage,
          operationRunId: runId, scheduleFollowUpRun: false, ...(scoped ? { observation: sourceObservation } : {}) });
        recordActivityEventSafely(recordActivityEventFn, buildMusicQueueRecoveryActivityEvent({ candidate: summaryCandidate,
          operationRunId: runId, recovery }));
        await appendRecoveryCandidate(recovery);
      }

      for (let queueIndex = 0; queueIndex < candidateQueue.length; queueIndex += 1) {
        const summaryCandidate = candidateQueue[queueIndex];
        if (processedCandidateIds.has(summaryCandidate.id)) {
          continue;
        }

        processedCandidateIds.add(summaryCandidate.id);
        await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });
        const persistedItem = persistedItemsByCandidateId.get(summaryCandidate.id) ?? null;
        const baseSnapshot = persistedItem?.planningSnapshot ?? {
          candidate: {
            downloadAttemptCount: summaryCandidate.downloadAttemptCount ?? 0,
            fileCount: summaryCandidate.fileCount,
            folderPath: summaryCandidate.folderPath,
            id: summaryCandidate.id,
            lockedFileCount: summaryCandidate.lockedFileCount,
            selectedAt: summaryCandidate.selectedAt,
            selectionReason: summaryCandidate.selectionReason ?? null,
            sourceProvider: summaryCandidate.sourceProvider,
            sourceSearchId: summaryCandidate.sourceSearchId,
            totalSizeBytes: summaryCandidate.totalSizeBytes,
            username: summaryCandidate.username,
          },
          execution: {
            mode: 'download_enqueue',
            requestedAt: new Date().toISOString(),
          },
          planning: summaryCandidate.planning,
        };

        const candidate = await getImportCandidate({ importCandidateId: summaryCandidate.id });
        const savedAttempt = baseSnapshot.execution?.handoff?.attempt;
        if (Object.hasOwn(baseSnapshot.execution?.handoff ?? {}, 'adoption')) {
          counts.blocked += 1;
          continue;
        }
        if (baseSnapshot.execution?.handoff?.state === 'not_dispatched') {
          counts.blocked += 1;
          continue;
        }
        if (savedAttempt || persistedItem?.itemStatus === 'awaiting_confirmation' || hasUnconfirmedDownloadHandoff(persistedItem)) {
          if (typeof confirmDownloadHandoff !== 'function') throw new TypeError('The download confirmation owner is required');
          const evidence = typeof findMatchingTransfers === 'function' ? await findMatchingTransfers({ attempt: savedAttempt,
            importCandidateId: summaryCandidate.id, operationRunId: runId, requestedFiles: baseSnapshot.execution?.requestedFiles,
            username: savedAttempt?.username }) : null;
          const receipt = await confirmDownloadHandoff({ importCandidateId: summaryCandidate.id, operationRunId: runId,
            attemptId: savedAttempt?.attemptId ?? null, expectedAttempt: savedAttempt,
            ...(evidence?.providerEvidence !== undefined ? { providerEvidence: evidence.providerEvidence } : {}) });
          await consumeReceipt({ receipt, candidate, summaryCandidate,
            sourceObservation: savedAttempt?.sourceObservation ?? baseSnapshot.execution?.sourceObservation });
          continue;
        }

        const sourceObservation = captureRecoveryObservation(candidate);
        const requestedFiles = buildEnqueueRequests((candidate?.files ?? []).filter((file) => !file.isLocked));
        const preparation = beginPreparation ? await beginPreparation({ runId, importCandidateId: summaryCandidate.id,
          requestedFiles, sourceObservation, lease: acquiredLease }) : { tracked: false, allowPreparation: true };
        if (!preparation.allowPreparation) {
          if (preparation.epoch?.phase === 'may_have_dispatched' || preparation.epoch?.phase === 'preparing') counts.awaitingConfirmation += 1;
          else counts.blocked += 1;
          continue;
        }
        let refusalAttempted = false;
        const seal = async (reasonCode) => {
          if (!preparation.tracked) return;
          refusalAttempted = true;
          if (!await refusePreparation({ runId, importCandidateId: summaryCandidate.id, epochId: preparation.epochId,
            lease: acquiredLease, reasonCode })) throw createApiError(409, 'import_execution_preparation_stale', 'The preparation changed before its refusal could be recorded');
        };
        let prepared; let preparedRecovery; let dispatchBoundaryReached = false; let finalGuardFailed = false;
        try {
          if (summaryCandidate.executionStatus.code === 'blocked') {
            const diagnostic = buildPlanningBlockedDiagnostic({
              candidate: summaryCandidate,
              message: summaryCandidate.executionStatus.message,
            });
            counts.blocked += 1;
            if (preparation.tracked) await seal('planning_blocked');
            else await updateImportExecutionRunItem({
              importCandidateId: summaryCandidate.id,
              itemStatus: 'blocked',
              operationRunId: runId,
              planningSnapshot: {
                ...baseSnapshot,
                execution: {
                  ...baseSnapshot.execution,
                  diagnostics: {
                    downloadAcceptance: diagnostic,
                  },
                  outcome: 'blocked',
                },
              },
              statusMessage: summaryCandidate.executionStatus.message,
            });
            continue;
          }

          if (requestedFiles.length === 0) {
            const diagnostic = buildNoUnlockedFilesDiagnostic({
              candidate: summaryCandidate,
            });
            counts.blocked += 1;
            if (preparation.tracked) await seal('no_unlocked_files');
            else await updateImportExecutionRunItem({
              importCandidateId: summaryCandidate.id,
              itemStatus: 'blocked',
              operationRunId: runId,
              planningSnapshot: {
                ...baseSnapshot,
                execution: {
                  ...baseSnapshot.execution,
                  diagnostics: {
                    downloadAcceptance: diagnostic,
                  },
                  outcome: 'blocked',
                  requestedFiles: [],
                },
              },
              statusMessage: diagnostic.message,
            });
            continue;
          }

          for (const fn of [prepareDownloadHandoff, confirmDownloadHandoff, assertDownloadHandoffCurrent, recordDownloadHandoffNotDispatched, getLease]) {
            if (typeof fn !== 'function') throw new TypeError('The download handoff owner and lease reader are required');
          }
          try { preparedRecovery = await resolveRecoveryExecution({ candidate, runId, triggerSource }); }
          catch (error) {
            if (error?.code === 'music_queue_recovery_not_current') await retireRecoveryExecution({ runId, candidateId: candidate.id, sourceObservation });
            throw error;
          }
          const dispatch = typeof prepareDownloadDispatch === 'function' ? await prepareDownloadDispatch() : null;
          prepared = await prepareDownloadHandoff({ importCandidateId: candidate.id, operationRunId: runId,
            requestedFiles, username: candidate.username, sourceObservation, providerBinding: dispatch?.binding ?? null,
            ...(preparation.tracked ? { preProviderEpochId: preparation.epochId, lease: acquiredLease } : {}) });
          if (!prepared.dispatchAllowed) {
            if (prepared.stale && !prepared.attempt) {
              await seal('prior_handoff_unresolved');
              counts.blocked += 1;
              continue;
            }
            const receipt = await confirmDownloadHandoff({ importCandidateId: candidate.id, operationRunId: runId,
              attemptId: prepared.attempt?.attemptId ?? null, expectedAttempt: prepared.attempt });
            await consumeReceipt({ receipt, candidate, summaryCandidate, sourceObservation: prepared.attempt?.sourceObservation ?? sourceObservation });
            continue;
          }
          const beforeSend = async () => {
            try {
              const currentLease = await getLease({ runId });
              if (!hasCurrentWorkerLease(currentLease, acquiredLease)) {
                throw createApiError(409, 'import_execution_lease_not_current', 'The worker lease changed before provider dispatch');
              }
              await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });
              await assertRecoveryExecutionCurrent({ candidateId: candidate.id, runId, triggerSource, prepared: preparedRecovery });
              await assertDownloadHandoffCurrent({ importCandidateId: candidate.id, operationRunId: runId,
                attemptId: prepared.attempt.attemptId, expectedAttempt: prepared.attempt });
              if (dispatch) await dispatch.assertCurrent();
              if (!hasCurrentWorkerLease(await getLease({ runId }), acquiredLease)) {
                throw createApiError(409, 'import_execution_lease_not_current', 'The worker lease changed before provider dispatch');
              }
              if (preparation.tracked) await markDispatchPossible({ runId, importCandidateId: candidate.id,
                epochId: preparation.epochId, lease: acquiredLease, attemptId: prepared.attempt.attemptId,
                assertProviderCurrent: dispatch?.assertCurrent });
              dispatchBoundaryReached = true;
            } catch (error) { finalGuardFailed = true; throw error; }
          };
          let enqueueResult;
          if (dispatch?.supportsBeforeSend === true) enqueueResult = await dispatch.enqueue({ attempt: prepared.attempt, beforeSend });
          else {
            await beforeSend();
            enqueueResult = dispatch ? await dispatch.enqueue({ attempt: prepared.attempt })
              : await enqueueDownloads({ files: prepared.attempt.requestedFiles, username: prepared.attempt.username });
          }
          const receipt = await confirmDownloadHandoff({ importCandidateId: candidate.id, operationRunId: runId,
            attemptId: prepared.attempt.attemptId, expectedAttempt: prepared.attempt, enqueueResult,
            warningMessage: summaryCandidate.executionStatus.code === 'ready_with_warnings' ? summaryCandidate.executionStatus.message : null });
          await consumeReceipt({ receipt, candidate, summaryCandidate, sourceObservation: prepared.attempt.sourceObservation });
        } catch (error) {
          if (!dispatchBoundaryReached) {
            if (preparation.tracked) {
              if (!refusalAttempted) {
                const refused = await refusePreparation({ runId, importCandidateId: summaryCandidate.id,
                  epochId: preparation.epochId, lease: acquiredLease, reasonCode: preProviderRefusalReason(error) });
                if (refused && prepared?.dispatchAllowed && finalGuardFailed) await retireRecoveryExecution({ runId,
                  candidateId: candidate.id, sourceObservation });
              }
            } else if (prepared?.dispatchAllowed && finalGuardFailed) {
              await retireRecoveryExecution({ runId, candidateId: candidate.id, sourceObservation, knownDispatchStartedAt: prepared.dispatchStartedAt });
              await recordDownloadHandoffNotDispatched({ importCandidateId: candidate.id, operationRunId: runId, attemptId: prepared.attempt.attemptId });
            }
          }
          throw error;
        }
      }

      await markRunCompleted({
        runId,
        summary: {
          blockedCount: counts.blocked,
          currentStep: 'Download enqueue complete',
          awaitingConfirmationCount: counts.awaitingConfirmation,
          executionMode: 'download_enqueue',
          processedCandidateCount: processedCandidateIds.size,
          queueFailedCount: counts.queueFailed,
          queuedCount: counts.queued,
          queuedWithWarningsCount: counts.queuedWithWarnings,
          readyCount: selectedSummary.counts?.ready ?? 0,
          readyWithWarningsCount: selectedSummary.counts?.readyWithWarnings ?? 0,
          recoveredCandidateCount: counts.recovered,
          requestedCandidateCount,
          ...triggerSummary,
          totalSelected: (selectedSummary.counts?.totalSelected ?? runItems.length) + counts.recovered,
        },
      });
    } catch (error) {
      if (error?.code === 'operation_run_lease_unavailable') {
        return;
      }

      if (isOperationRunPauseError(error)) {
        finalLeaseStatus = 'paused';
        await markRunPaused({
          nextAttemptAt: error.nextRetryAt ?? null,
          runId,
          summary: {
            currentStep: 'Download enqueue paused by maintenance lock',
            executionMode: 'download_enqueue',
            pauseCode: error.pauseCode ?? null,
            pauseMessage: error.message,
            pauseProvider: error.pauseProvider ?? null,
            requestedCandidateCount,
            ...triggerSummary,
          },
        });
        return;
      }

      if (isOperationRunCancellationError(error)) {
        finalLeaseStatus = 'cancelled';
        await markRunCancelled({
          runId,
          summary: {
            currentStep: 'Download enqueue cancelled',
            executionMode: 'download_enqueue',
            requestedCandidateCount,
            ...triggerSummary,
          },
        });
        return;
      }

      finalLeaseStatus = 'failed';
      await markRunFailed({
        errorMessage: error.message,
        runId,
        summary: {
          currentStep: 'Download enqueue failed',
          executionMode: 'download_enqueue',
          requestedCandidateCount,
          ...triggerSummary,
        },
      });
    } finally {
      leaseHeartbeat?.stop();
      activeRunIds.delete(runId);
      if (leaseAcquired) {
        await releaseLease({ runId, status: finalLeaseStatus });
      }
    }
  }

  async function startWorkerRun({
    requestedCandidateCount,
    runId,
    selectedCandidateId = null,
    sourceSearchId = null,
    triggerSource = null,
  }) {
    if (activeRunIds.has(runId)) {
      return;
    }

    activeRunIds.add(runId);
    queueMicrotask(() => {
      void runExecution({
        requestedCandidateCount,
        runId,
        selectedCandidateId,
        sourceSearchId,
        triggerSource,
      });
    });
  }

  return {
    startWorkerRun,
  };
}
