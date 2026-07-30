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

import { buildMusicQueueQualityBlockedActivityEvent } from '../activity/music-queue-quality-activity-presentation-service.js';
import { recordActivityEventSafely } from '../activity/music-queue-lifecycle-activity-event-service.js';
import { buildReleaseAddedActivityEvent } from '../activity/release-added-activity-presentation-service.js';
import { buildRequestFulfilledActivityEvent } from '../activity/request-fulfillment-activity-event-service.js';
import { classifyApplyOutcomeQuality } from '../activity/source-user-outcome-quality.js';
import { createOperationRunLeaseHeartbeat } from '../heartbeat/operation-run-lease-heartbeat.js';
import { assessDeliveredQuality } from '../media/media-delivery-quality.js';
import { createImportCandidateSafeAutoAddQualityGateService } from './import-candidate-safe-auto-add-quality-gate.js';
import {
  isOperationRunCancellationError,
  isOperationRunPauseError,
  throwIfOperationRunCancellationRequested,
} from '../operation-run-cancellation.js';

function buildRunItems(importPendingCandidates) {
  return importPendingCandidates.map((candidate, index) => ({
    applySnapshot: {
      candidate: {
        fileCount: candidate.fileCount,
        folderPath: candidate.folderPath,
        id: candidate.id,
        importPendingAt: candidate.importPendingAt,
        lockedFileCount: candidate.lockedFileCount,
        musicQueueContext: candidate.musicQueueContext ?? null,
        sourceProvider: candidate.sourceProvider,
        sourceSearchId: candidate.sourceSearchId,
        totalSizeBytes: candidate.totalSizeBytes,
        username: candidate.username,
      },
      planning: candidate.planning,
      preview: candidate.applyPreview,
    },
    importCandidateId: candidate.id,
    itemStatus: candidate.importStatus.code,
    position: index + 1,
    statusMessage: candidate.importStatus.message,
  }));
}

function isSafeAutoCandidate(summaryCandidate) {
  return summaryCandidate?.importStatus?.code === 'ready';
}

function resolveRunnableCandidates(importPendingCandidates, applySafetyMode) {
  if (applySafetyMode !== 'safe_auto') {
    return importPendingCandidates;
  }

  return importPendingCandidates.filter(isSafeAutoCandidate);
}

function buildApplyTriggerSummary({ applySafetyMode, triggerSource }) {
  return {
    ...(applySafetyMode !== 'manual' ? { applySafetyMode } : {}),
    ...(triggerSource !== 'manual' ? { triggerSource } : {}),
  };
}

function buildSkippedUnsafeCandidateCount(importPendingSummary, runItems, applySafetyMode) {
  if (applySafetyMode !== 'safe_auto') {
    return {};
  }

  return {
    skippedUnsafeCandidateCount: Math.max(
      (importPendingSummary.counts?.totalImportPending ?? 0) - runItems.length,
      0,
    ),
  };
}

function createBaseSnapshot(summaryCandidate) {
  return {
    apply: {
      executionMode: 'move',
      requestedAt: new Date().toISOString(),
    },
    candidate: {
      fileCount: summaryCandidate.fileCount,
      folderPath: summaryCandidate.folderPath,
      id: summaryCandidate.id,
      importPendingAt: summaryCandidate.importPendingAt,
      lockedFileCount: summaryCandidate.lockedFileCount,
      musicQueueContext: summaryCandidate.musicQueueContext ?? null,
      sourceProvider: summaryCandidate.sourceProvider,
      sourceSearchId: summaryCandidate.sourceSearchId,
      totalSizeBytes: summaryCandidate.totalSizeBytes,
      username: summaryCandidate.username,
    },
    planning: summaryCandidate.planning,
    preview: summaryCandidate.applyPreview,
  };
}

function buildApplyStatusMessage({ applyResult, importStatusCode }) {
  const summary = applyResult.summary;
  if ((summary.failedFileCount ?? 0) > 0) {
    return `Import apply failed after ${summary.appliedFileCount ?? 0} file${summary.appliedFileCount === 1 ? '' : 's'} completed.`;
  }

  let message = `${summary.appliedFileCount ?? 0} file${summary.appliedFileCount === 1 ? ' was' : 's were'} applied into the library.`;
  if ((summary.skippedFileCount ?? 0) > 0) {
    message = `${message} ${summary.skippedFileCount} colliding file${summary.skippedFileCount === 1 ? ' was' : 's were'} skipped by saved operator decision.`;
  }

  if ((summary.transcodePreflightFailedCount ?? 0) > 0) {
    message = `${message} ${summary.transcodePreflightFailedCount} transcode preflight validation${summary.transcodePreflightFailedCount === 1 ? ' check failed' : ' checks failed'} and should be reviewed.`;
  }

  if ((summary.transcodePreflightUnavailableCount ?? 0) > 0) {
    message = `${message} ${summary.transcodePreflightUnavailableCount} transcode preflight validation${summary.transcodePreflightUnavailableCount === 1 ? ' check was skipped because ffmpeg is unavailable' : ' checks were skipped because ffmpeg is unavailable'}.`;
  }

  return importStatusCode === 'ready_with_warnings'
    ? `${message} Import preview warnings were present when the run started.`
    : message;
}

function extractFileExtension(filename) {
  if (typeof filename !== 'string') {
    return null;
  }
  const trimmed = filename.trim().toLowerCase();
  const dotIndex = trimmed.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) {
    return null;
  }
  return trimmed.slice(dotIndex + 1);
}

// Builds spectral-analysis descriptors for files that were just moved into the
// library, pointing at their final library path (the file the FFT pass must
// decode). Only successfully applied files with a known library path are
// eligible; the sidecar service filters down to lossless-claimed candidates.
function buildSpectralFileDescriptors(applyPreview) {
  const files = Array.isArray(applyPreview?.files) ? applyPreview.files : [];
  const descriptors = [];
  for (const file of files) {
    const libraryPath = file?.libraryTarget?.path;
    if (typeof libraryPath !== 'string' || libraryPath.trim().length === 0) {
      continue;
    }
    if (file?.status?.code && file.status.code !== 'ready') {
      continue;
    }
    const metadata = file?.inspection && typeof file.inspection === 'object'
      ? file.inspection.metadata
      : null;
    descriptors.push({
      bitRate: metadata?.bitRate ?? null,
      declaredCodec: metadata?.primaryAudioCodec ?? null,
      declaredExtension: extractFileExtension(file?.filename),
      filePath: libraryPath,
      sampleRate: metadata?.sampleRate ?? null,
    });
  }
  return descriptors;
}

export function createImportCandidateApplyWorker({
  acquireLease,
  applyImportCandidatePreview = async () => ({
    executionMode: 'move',
    fileOperations: [],
    summary: {
      appliedFileCount: 0,
      failedFileCount: 0,
      notAttemptedCount: 0,
      stagedFromSourceCount: 0,
      totalFiles: 0,
    },
  }),
  buildImportPendingCandidateSummary = async () => ({
    counts: {
      blocked: 0,
      ready: 0,
      readyWithWarnings: 0,
      totalImportPending: 0,
    },
    importPendingCandidates: [],
  }),
  buildPostApplyReleaseHints = async () => [],
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  isCancellationRequested,
  markImportCandidateApplied = async () => null,
  markRunCompleted,
  markRunPaused,
  markRunCancelled,
  markRunFailed,
  markRunStarted,
  handleImportCandidateQualityFailure = null,
  safeAutoAddQualityGateService = createImportCandidateSafeAutoAddQualityGateService(),
  previewImportCandidateApply = async () => ({
    files: [],
    preview: null,
    summary: { status: 'blocked' },
  }),
  releaseLease,
  renewLease,
  replaceImportApplyRunItems = async () => [],
  scheduleLibraryScan = null,
  sendFulfillmentNotificationFn = null,
  onReleaseAddedFn = null,
  recordActivityEventFn = null,
  enqueueSpectralAnalysisFn = null,
  processPendingSpectralJobsFn = null,
  spectralDrainLimit = 8,
  updateImportApplyRunItem = async () => null,
} = {}) {
  const activeRunIds = new Set();

  function buildQualityRecoverySummary(qualityRecoveries) {
    if (!Array.isArray(qualityRecoveries) || qualityRecoveries.length === 0) {
      return {};
    }

    return {
      qualityRecoveryExhaustedCount: qualityRecoveries
        .filter((recovery) => recovery?.recovered !== true && recovery?.rediscovery?.scheduled !== true)
        .length,
      qualityRecoveryRediscoveryCount: qualityRecoveries
        .filter((recovery) => recovery?.rediscovery?.scheduled === true)
        .length,
      qualityRecoveryStartedCount: qualityRecoveries
        .filter((recovery) => recovery?.recovered === true)
        .length,
    };
  }

  async function runApply({
    applySafetyMode = 'manual',
    executableCandidateCount,
    requestedCandidateCount,
    runId,
    triggerSource = 'manual',
  }) {
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
          currentStep: 'Resolving import-pending candidate apply plans',
          executionMode: 'move',
          executableCandidateCount,
          requestedCandidateCount,
          ...buildApplyTriggerSummary({ applySafetyMode, triggerSource }),
        },
      });

      const importPendingSummary = await buildImportPendingCandidateSummary({ limit: 1000 });
      const runnableCandidates = resolveRunnableCandidates(
        importPendingSummary.importPendingCandidates ?? [],
        applySafetyMode,
      );
      const runItems = buildRunItems(runnableCandidates);
      await replaceImportApplyRunItems(runId, runItems);

      const counts = {
        applied: 0,
        appliedWithWarnings: 0,
        applyFailed: 0,
        blocked: 0,
        qualityBlocked: 0,
      };
      const postApplyReleaseHints = [];
      const qualityRecoveries = [];

      for (const summaryCandidate of runnableCandidates) {
        await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });
        const baseSnapshot = createBaseSnapshot(summaryCandidate);

        if (summaryCandidate.importStatus.code === 'blocked') {
          counts.blocked += 1;
          await updateImportApplyRunItem({
            applySnapshot: {
              ...baseSnapshot,
              apply: {
                ...baseSnapshot.apply,
                outcome: 'blocked',
              },
            },
            importCandidateId: summaryCandidate.id,
            itemStatus: 'blocked',
            operationRunId: runId,
            statusMessage: summaryCandidate.importStatus.message,
          });
          continue;
        }

        try {
          const applyPreview = await previewImportCandidateApply({ importCandidateId: summaryCandidate.id });
          if (applySafetyMode === 'safe_auto') {
            const qualityGate = await safeAutoAddQualityGateService.evaluateSafeAutoAddQuality({
              applyPreview,
              summaryCandidate,
            });
            if (!qualityGate.eligible) {
              counts.blocked += 1;
              counts.qualityBlocked += 1;
              await updateImportApplyRunItem({
                applySnapshot: {
                  ...baseSnapshot,
                  apply: {
                    ...baseSnapshot.apply,
                    outcome: 'quality_blocked',
                    qualityGate,
                  },
                  fullPreview: {
                    counts: applyPreview.counts,
                    summary: applyPreview.summary,
                  },
                },
                importCandidateId: summaryCandidate.id,
                itemStatus: 'blocked',
                operationRunId: runId,
                statusMessage: qualityGate.message,
              });
              if (typeof recordActivityEventFn === 'function') {
                recordActivityEventSafely(recordActivityEventFn, buildMusicQueueQualityBlockedActivityEvent({
                  qualityGate,
                  runId,
                  summaryCandidate,
                }));
              }
              if (typeof handleImportCandidateQualityFailure === 'function') {
                try {
                  qualityRecoveries.push(await handleImportCandidateQualityFailure({
                    failedCandidateId: summaryCandidate.id,
                    failureReason: qualityGate.message,
                    operationRunId: runId,
                    profileCode: qualityGate.profileCode,
                    qualityLabel: qualityGate.status ?? 'quality_blocked',
                    qualityWeight: 0,
                    scheduleFollowUpRun: true,
                  }));
                } catch (error) {
                  qualityRecoveries.push({
                    failedCandidateId: summaryCandidate.id,
                    reason: error?.code ?? 'quality_recovery_failed',
                    recovered: false,
                  });
                }
              }
              continue;
            }
          }
          const applyResult = await applyImportCandidatePreview({
            applyPreview,
            executionMode: 'move',
            importCandidateId: summaryCandidate.id,
            operationRunId: runId,
          });
          const itemStatus = (applyResult.summary.failedFileCount ?? 0) > 0
            ? 'apply_failed'
            : summaryCandidate.importStatus.code === 'ready_with_warnings'
              || (applyResult.summary.transcodePreflightFailedCount ?? 0) > 0
              || (applyResult.summary.transcodePreflightUnavailableCount ?? 0) > 0
              || (applyResult.summary.skippedFileCount ?? 0) > 0
              ? 'applied_with_warnings'
              : 'applied';
          const statusMessage = buildApplyStatusMessage({
            applyResult,
            importStatusCode: summaryCandidate.importStatus.code,
          });

          if (itemStatus === 'apply_failed') {
            counts.applyFailed += 1;
          } else if (itemStatus === 'applied_with_warnings') {
            counts.appliedWithWarnings += 1;
          } else {
            counts.applied += 1;
          }

          await updateImportApplyRunItem({
            applySnapshot: {
              ...baseSnapshot,
              apply: {
                ...baseSnapshot.apply,
                outcome: itemStatus,
                result: applyResult.summary,
              },
              fileOperations: applyResult.fileOperations,
              fullPreview: {
                counts: applyPreview.counts,
                summary: applyPreview.summary,
              },
            },
            importCandidateId: summaryCandidate.id,
            itemStatus,
            operationRunId: runId,
            statusMessage,
          });

          if (itemStatus !== 'apply_failed') {
            // Grade the *fidelity* of what was delivered (fake/transcoded
            // lossless, low bitrate, missing tags) from the preview inspection
            // metadata, so the reputation ledger downgrades poor sources even
            // when the apply itself completed cleanly.
            const deliveryQuality = assessDeliveredQuality({ files: applyPreview.files });
            const outcomeQuality = classifyApplyOutcomeQuality({
              status: itemStatus,
              summary: applyResult.summary,
              deliveryQuality,
            });
            await markImportCandidateApplied({
              importCandidateId: summaryCandidate.id,
              qualityLabel: outcomeQuality.qualityLabel,
              qualityWeight: outcomeQuality.qualityWeight,
              reason: statusMessage,
            });

            // Off-path producer: queue the heavy spectral-cutoff FFT analysis for
            // lossless-claimed files now living in the library. This is fire and
            // forget and honours queue back-pressure, so it can never stall or
            // fail the apply run.
            if (typeof enqueueSpectralAnalysisFn === 'function' && summaryCandidate.username) {
              void Promise.resolve(enqueueSpectralAnalysisFn({
                files: buildSpectralFileDescriptors(applyPreview),
                importCandidateId: summaryCandidate.id,
                username: summaryCandidate.username,
              })).catch(() => {});
            }

            try {
              const releaseHints = await buildPostApplyReleaseHints({
                applyResult,
                summaryCandidate,
              });
              if (Array.isArray(releaseHints) && releaseHints.length > 0) {
                postApplyReleaseHints.push(...releaseHints);
              }
            } catch {
              // Release hints improve post-apply matching, but a hint lookup must not
              // reclassify files that were already moved into the library.
            }

            const notifyUserId = summaryCandidate.requestOwnership?.sourceRequestedForUserId
              ?? summaryCandidate.requestOwnership?.sourceRequestedByUserId
              ?? null;
            if (notifyUserId && typeof sendFulfillmentNotificationFn === 'function') {
              void sendFulfillmentNotificationFn({ userId: notifyUserId }).catch(() => {});
            }

            if (typeof onReleaseAddedFn === 'function') {
              void onReleaseAddedFn({
                artistName: summaryCandidate.releaseIdentity?.artistName ?? null,
                folderPath: summaryCandidate.folderPath ?? null,
                importCandidateId: summaryCandidate.id,
                releaseTitle: summaryCandidate.releaseIdentity?.releaseTitle ?? null,
                username: summaryCandidate.username ?? null,
              }).catch(() => {});
            }

            if (typeof recordActivityEventFn === 'function') {
              void recordActivityEventFn(buildReleaseAddedActivityEvent({
                artistName: summaryCandidate.releaseIdentity?.artistName ?? null,
                entityId: summaryCandidate.id,
                entityType: 'import_candidate',
                fallbackEntityTitle: summaryCandidate.folderPath ?? null,
                operationType: 'import_candidate_apply',
                releaseTitle: summaryCandidate.releaseIdentity?.releaseTitle ?? null,
                runId,
                wantedReleaseId: summaryCandidate.musicQueueContext?.wantedReleaseId ?? null,
              })).catch(() => {});
            }

            if (notifyUserId && typeof recordActivityEventFn === 'function') {
              const requestFulfilledEvent = buildRequestFulfilledActivityEvent({ candidate: summaryCandidate });
              if (requestFulfilledEvent) {
                void recordActivityEventFn(requestFulfilledEvent).catch(() => {});
              }
            }
          }
        } catch (error) {
          counts.applyFailed += 1;
          await updateImportApplyRunItem({
            applySnapshot: {
              ...baseSnapshot,
              apply: {
                ...baseSnapshot.apply,
                errorMessage: error instanceof Error ? error.message : String(error),
                outcome: 'apply_failed',
              },
            },
            importCandidateId: summaryCandidate.id,
            itemStatus: 'apply_failed',
            operationRunId: runId,
            statusMessage: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await markRunCompleted({
        runId,
        summary: {
          appliedCount: counts.applied,
          appliedWithWarningsCount: counts.appliedWithWarnings,
          applyFailedCount: counts.applyFailed,
          blockedCount: counts.blocked,
          currentStep: 'Import apply complete',
          executionMode: 'move',
          processedCandidateCount: runItems.length,
          readyCount: importPendingSummary.counts?.ready ?? 0,
          readyWithWarningsCount: importPendingSummary.counts?.readyWithWarnings ?? 0,
          requestedCandidateCount,
          ...(counts.qualityBlocked > 0 ? { qualityBlockedCount: counts.qualityBlocked } : {}),
          ...buildQualityRecoverySummary(qualityRecoveries),
          ...buildApplyTriggerSummary({ applySafetyMode, triggerSource }),
          ...buildSkippedUnsafeCandidateCount(importPendingSummary, runItems, applySafetyMode),
          totalImportPending: importPendingSummary.counts?.totalImportPending ?? runItems.length,
        },
      });

      if (typeof scheduleLibraryScan === 'function' && (counts.applied + counts.appliedWithWarnings) > 0) {
        try {
          await scheduleLibraryScan({
            releaseHints: postApplyReleaseHints,
            triggeredByRunId: runId,
          });
        } catch {
          // A scan that is already queued/running, or a scan readiness failure, should not
          // turn an otherwise successful import apply run into a failed operation.
        }
      }

      // Off-path consumer: drain a bounded batch of queued spectral-analysis
      // jobs at the tail of the run. Confirmed transcodes are merged back into
      // the reputation ledger by the sidecar service. Bounded + best-effort so
      // the heavy FFT work never extends or fails an apply run.
      if (typeof processPendingSpectralJobsFn === 'function') {
        try {
          await processPendingSpectralJobsFn({ limit: spectralDrainLimit });
        } catch {
          // Spectral analysis is advisory; a drain failure must not fail the run.
        }
      }
    } catch (error) {
      if (isOperationRunPauseError(error)) {
        finalLeaseStatus = 'paused';
        await markRunPaused({
          nextAttemptAt: error.nextRetryAt ?? null,
          runId,
          summary: {
            currentStep: 'Import apply paused by maintenance lock',
            executionMode: 'move',
            executableCandidateCount,
            pauseCode: error.pauseCode ?? null,
            pauseMessage: error.message,
            pauseProvider: error.pauseProvider ?? null,
            requestedCandidateCount,
            ...buildApplyTriggerSummary({ applySafetyMode, triggerSource }),
          },
        });
        return;
      }

      if (isOperationRunCancellationError(error)) {
        finalLeaseStatus = 'cancelled';
        await markRunCancelled({
          runId,
          summary: {
            currentStep: 'Import apply cancelled',
            executionMode: 'move',
            executableCandidateCount,
            requestedCandidateCount,
            ...buildApplyTriggerSummary({ applySafetyMode, triggerSource }),
          },
        });
        return;
      }

      finalLeaseStatus = 'failed';
      await markRunFailed({
        errorMessage: error.message,
        runId,
        summary: {
          currentStep: 'Import apply failed',
          executionMode: 'move',
          executableCandidateCount,
          requestedCandidateCount,
          ...buildApplyTriggerSummary({ applySafetyMode, triggerSource }),
        },
      });
    } finally {
      leaseHeartbeat?.stop();
      activeRunIds.delete(runId);
      await releaseLease({ runId, status: finalLeaseStatus });
    }
  }

  async function startWorkerRun({
    applySafetyMode = 'manual',
    executableCandidateCount,
    requestedCandidateCount,
    runId,
    triggerSource = 'manual',
  }) {
    if (activeRunIds.has(runId)) {
      return;
    }

    activeRunIds.add(runId);
    queueMicrotask(() => {
      void runApply({
        applySafetyMode,
        executableCandidateCount,
        requestedCandidateCount,
        runId,
        triggerSource,
      });
    });
  }

  return {
    startWorkerRun,
  };
}
