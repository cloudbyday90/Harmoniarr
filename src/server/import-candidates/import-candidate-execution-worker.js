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

import { createOperationRunLeaseHeartbeat } from '../heartbeat/operation-run-lease-heartbeat.js';
import {
  isOperationRunCancellationError,
  isOperationRunPauseError,
  throwIfOperationRunCancellationRequested,
} from '../operation-run-cancellation.js';

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
  getImportCandidate = async () => null,
  handleImportCandidateDownloadFailure = async () => ({ recovered: false }),
  isCancellationRequested,
  markRunPaused,
  markImportCandidateDownloadFailed = async () => null,
  markImportCandidateDownloading = async () => null,
  markRunCompleted,
  markRunCancelled,
  markRunFailed,
  markRunStarted,
  releaseLease,
  renewLease,
  replaceImportExecutionRunItems = async () => [],
  updateImportExecutionRunItem = async () => null,
  upsertImportExecutionRunItem = async () => null,
} = {}) {
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

  async function runExecution({ requestedCandidateCount, runId }) {
    let finalLeaseStatus = 'completed';
    let leaseHeartbeat = null;

    try {
      await acquireLease({ runId });
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
        },
      });

      const selectedSummary = await buildSelectedImportCandidateSummary({ limit: 1000 });
      const candidateQueue = [...(selectedSummary.selectedCandidates ?? [])];
      const runItems = buildRunItems(candidateQueue);
      await replaceImportExecutionRunItems(runId, runItems);

      const counts = {
        blocked: 0,
        queueFailed: 0,
        queued: 0,
        queuedWithWarnings: 0,
        recovered: 0,
      };
      const processedCandidateIds = new Set();

      async function appendRecoveryCandidate(recoveryResult) {
        if (!recoveryResult?.recovered || !recoveryResult.nextCandidateId) {
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

      for (let queueIndex = 0; queueIndex < candidateQueue.length; queueIndex += 1) {
        const summaryCandidate = candidateQueue[queueIndex];
        if (processedCandidateIds.has(summaryCandidate.id)) {
          continue;
        }

        processedCandidateIds.add(summaryCandidate.id);
        await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });
        const baseSnapshot = {
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

        if (summaryCandidate.executionStatus.code === 'blocked') {
          counts.blocked += 1;
          await updateImportExecutionRunItem({
            importCandidateId: summaryCandidate.id,
            itemStatus: 'blocked',
            operationRunId: runId,
            planningSnapshot: {
              ...baseSnapshot,
              execution: {
                ...baseSnapshot.execution,
                outcome: 'blocked',
              },
            },
            statusMessage: summaryCandidate.executionStatus.message,
          });
          continue;
        }

        const candidate = await getImportCandidate({ importCandidateId: summaryCandidate.id });
        const requestedFiles = buildEnqueueRequests((candidate?.files ?? []).filter((file) => !file.isLocked));

        if (requestedFiles.length === 0) {
          counts.blocked += 1;
          await updateImportExecutionRunItem({
            importCandidateId: summaryCandidate.id,
            itemStatus: 'blocked',
            operationRunId: runId,
            planningSnapshot: {
              ...baseSnapshot,
              execution: {
                ...baseSnapshot.execution,
                outcome: 'blocked',
                requestedFiles: [],
              },
            },
            statusMessage: 'No unlocked files are available to enqueue from this candidate.',
          });
          continue;
        }

        const enqueueResult = await enqueueDownloads({
          files: requestedFiles,
          username: summaryCandidate.username,
        });
        const failedCount = enqueueResult.failed.length;
        const enqueuedCount = enqueueResult.enqueued.length;
        const itemStatus = failedCount > 0 && enqueuedCount === 0
          ? 'queue_failed'
          : failedCount > 0 || summaryCandidate.executionStatus.code === 'ready_with_warnings'
            ? 'queued_with_warnings'
            : 'queued';

        if (itemStatus === 'queue_failed') {
          counts.queueFailed += 1;
        } else if (itemStatus === 'queued_with_warnings') {
          counts.queuedWithWarnings += 1;
        } else {
          counts.queued += 1;
        }

        const failedMessage = failedCount > 0
          ? `Failed to enqueue ${failedCount} of ${requestedFiles.length} file${requestedFiles.length === 1 ? '' : 's'}.`
          : null;
        const warningMessage = summaryCandidate.executionStatus.code === 'ready_with_warnings'
          ? summaryCandidate.executionStatus.message
          : null;
        const statusMessage = itemStatus === 'queue_failed'
          ? failedMessage ?? 'Download enqueue failed.'
          : [
            `${enqueuedCount} file${enqueuedCount === 1 ? '' : 's'} accepted by slskd for download.`,
            warningMessage,
            failedMessage,
          ].filter(Boolean).join(' ');

        await updateImportExecutionRunItem({
          importCandidateId: summaryCandidate.id,
          itemStatus,
          operationRunId: runId,
          planningSnapshot: {
            ...baseSnapshot,
            execution: {
              ...baseSnapshot.execution,
              enqueuedTransfers: enqueueResult.enqueued,
              failedFilenames: enqueueResult.failed,
              outcome: itemStatus,
              requestedFiles,
            },
          },
          statusMessage,
        });

        if (itemStatus === 'queue_failed') {
          await markImportCandidateDownloadFailed({
            importCandidateId: summaryCandidate.id,
            reason: statusMessage,
          });
          const recoveryResult = await handleImportCandidateDownloadFailure({
            failedCandidateId: summaryCandidate.id,
            failureReason: statusMessage,
            operationRunId: runId,
            scheduleFollowUpRun: false,
          });
          if (recoveryResult?.recovered) {
            const recoveryMessage = `Recovery cascade promoted candidate ${recoveryResult.nextCandidateId}.`;
            await updateImportExecutionRunItem({
              importCandidateId: summaryCandidate.id,
              itemStatus,
              operationRunId: runId,
              planningSnapshot: {
                ...baseSnapshot,
                execution: {
                  ...baseSnapshot.execution,
                  enqueuedTransfers: enqueueResult.enqueued,
                  failedFilenames: enqueueResult.failed,
                  outcome: itemStatus,
                  recovery: recoveryResult,
                  requestedFiles,
                },
              },
              statusMessage: `${statusMessage} ${recoveryMessage}`,
            });
            await appendRecoveryCandidate(recoveryResult);
          }
        } else {
          await markImportCandidateDownloading({
            importCandidateId: summaryCandidate.id,
            reason: statusMessage,
          });
        }
      }

      await markRunCompleted({
        runId,
        summary: {
          blockedCount: counts.blocked,
          currentStep: 'Download enqueue complete',
          executionMode: 'download_enqueue',
          processedCandidateCount: processedCandidateIds.size,
          queueFailedCount: counts.queueFailed,
          queuedCount: counts.queued,
          queuedWithWarningsCount: counts.queuedWithWarnings,
          readyCount: selectedSummary.counts?.ready ?? 0,
          readyWithWarningsCount: selectedSummary.counts?.readyWithWarnings ?? 0,
          recoveredCandidateCount: counts.recovered,
          requestedCandidateCount,
          totalSelected: (selectedSummary.counts?.totalSelected ?? runItems.length) + counts.recovered,
        },
      });
    } catch (error) {
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
        },
      });
    } finally {
      leaseHeartbeat?.stop();
      activeRunIds.delete(runId);
      await releaseLease({ runId, status: finalLeaseStatus });
    }
  }

  async function startWorkerRun({ requestedCandidateCount, runId }) {
    if (activeRunIds.has(runId)) {
      return;
    }

    activeRunIds.add(runId);
    queueMicrotask(() => {
      void runExecution({ requestedCandidateCount, runId });
    });
  }

  return {
    startWorkerRun,
  };
}
