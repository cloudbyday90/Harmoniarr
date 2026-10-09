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

import { isOperationRunLeaseLostError } from '../operation-run-lease-error.js';
import { createOperationRunLeaseHeartbeat } from '../heartbeat/operation-run-lease-heartbeat.js';
import {
  isOperationRunCancellationError,
  isOperationRunPauseError,
  throwIfOperationRunCancellationRequested,
} from '../operation-run-cancellation.js';

function isTranscodeCandidate(file) {
  return file?.transcodePlan?.recommendedAction === 'transcode_candidate';
}

function summarizeWarnings(transcodeExecution = null) {
  return transcodeExecution?.warnings?.length ?? 0;
}

export function createImportCandidateTranscodeWorker({
  acquireLease,
  buildSelectedImportCandidateSummary = async () => ({
    selectedCandidates: [],
  }),
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  executeTranscodeCandidate = async ({ sourcePath: _sourcePath, transcodePlan }) => ({
    mode: 'preflight_only',
    status: transcodePlan?.recommendedAction === 'transcode_candidate' ? 'preflight_passed' : 'not_required',
    warnings: [],
  }),
  isCancellationRequested,
  markRunPaused,
  markRunCancelled,
  markRunCompleted,
  markRunFailed,
  markRunStarted,
  previewImportCandidateApply = async () => ({ files: [] }),
  releaseLease,
  renewLease,
} = {}) {
  const activeRunIds = new Set();

  async function runTranscodeOrchestration({ requestedCandidateCount, runId, transcodeCandidateFileCount }) {
    let finalLeaseStatus = 'completed';
    let leaseHeartbeat = null;
    let acquiredLease = null;

    try {
      acquiredLease = await acquireLease({ runId });
      if (renewLease) {
        leaseHeartbeat = createOperationRunLeaseHeartbeatFn({ renewLease, runId, expectedLease: acquiredLease });
        leaseHeartbeat.start();
      }

      await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });
      if (await markRunStarted({ expectedLease: acquiredLease,
        runId,
        summary: {
          currentStep: 'Running transcode orchestration preflight',
          requestedCandidateCount,
          transcodeCandidateFileCount,
        },
      }) === false) return;

      const selectedSummary = await buildSelectedImportCandidateSummary({ limit: 1000 });
      const counters = {
        blockedCandidateCount: 0,
        failedPreflightCount: 0,
        notRequiredCount: 0,
        passedPreflightCount: 0,
        reviewedCandidateCount: 0,
        toolingUnavailableCount: 0,
        transcodeCandidateFileCount: 0,
        warningCount: 0,
      };

      for (const candidate of selectedSummary.selectedCandidates ?? []) {
        await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });

        if (candidate?.executionStatus?.code === 'blocked') {
          counters.blockedCandidateCount += 1;
          continue;
        }

        const applyPreview = await previewImportCandidateApply({
          importCandidateId: candidate.id,
        });
        counters.reviewedCandidateCount += 1;

        for (const file of applyPreview.files ?? []) {
          await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });

          if (!isTranscodeCandidate(file)) {
            continue;
          }

          counters.transcodeCandidateFileCount += 1;
          const transcodeExecution = await executeTranscodeCandidate({
            sourcePath: file?.sourceFile?.path,
            transcodePlan: file?.transcodePlan,
          });
          counters.warningCount += summarizeWarnings(transcodeExecution);

          if (transcodeExecution?.status === 'preflight_passed') {
            counters.passedPreflightCount += 1;
          } else if (transcodeExecution?.status === 'preflight_failed') {
            counters.failedPreflightCount += 1;
          } else if (transcodeExecution?.status === 'tooling_unavailable') {
            counters.toolingUnavailableCount += 1;
          } else {
            counters.notRequiredCount += 1;
          }
        }
      }

      if (await markRunCompleted({ expectedLease: acquiredLease,
        runId,
        summary: {
          blockedCandidateCount: counters.blockedCandidateCount,
          currentStep: 'Transcode orchestration complete',
          failedPreflightCount: counters.failedPreflightCount,
          notRequiredCount: counters.notRequiredCount,
          passedPreflightCount: counters.passedPreflightCount,
          requestedCandidateCount,
          reviewedCandidateCount: counters.reviewedCandidateCount,
          toolingUnavailableCount: counters.toolingUnavailableCount,
          transcodeCandidateFileCount: counters.transcodeCandidateFileCount,
          warningCount: counters.warningCount,
        },
      }) === false) return;
    } catch (error) {
      if (!acquiredLease || isOperationRunLeaseLostError(error)) return;
      if (isOperationRunPauseError(error)) {
        finalLeaseStatus = 'paused';
        await markRunPaused({ expectedLease: acquiredLease,
          nextAttemptAt: error.nextRetryAt ?? null,
          runId,
          summary: {
            currentStep: 'Transcode orchestration paused by maintenance lock',
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
        await markRunCancelled({ expectedLease: acquiredLease,
          runId,
          summary: {
            currentStep: 'Transcode orchestration cancelled',
            requestedCandidateCount,
          },
        });
        return;
      }

      finalLeaseStatus = 'failed';
      await markRunFailed({ expectedLease: acquiredLease,
        errorMessage: error.message,
        runId,
        summary: {
          currentStep: 'Transcode orchestration failed',
          requestedCandidateCount,
        },
      });
    } finally {
      leaseHeartbeat?.stop();
      activeRunIds.delete(runId);
      if (acquiredLease) await releaseLease({ runId, status: finalLeaseStatus, expectedLease: acquiredLease });
    }
  }

  async function startWorkerRun({ requestedCandidateCount, runId, transcodeCandidateFileCount }) {
    if (activeRunIds.has(runId)) {
      return;
    }

    activeRunIds.add(runId);
    queueMicrotask(() => {
      void runTranscodeOrchestration({ requestedCandidateCount, runId, transcodeCandidateFileCount });
    });
  }

  return {
    startWorkerRun,
  };
}
