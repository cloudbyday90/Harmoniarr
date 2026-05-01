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

function buildRunItems(importPendingCandidates) {
  return importPendingCandidates.map((candidate, index) => ({
    applySnapshot: {
      candidate: {
        fileCount: candidate.fileCount,
        folderPath: candidate.folderPath,
        id: candidate.id,
        importPendingAt: candidate.importPendingAt,
        lockedFileCount: candidate.lockedFileCount,
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

  return importStatusCode === 'ready_with_warnings'
    ? `${message} Import preview warnings were present when the run started.`
    : message;
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
  markImportCandidateApplied = async () => null,
  markRunCompleted,
  markRunFailed,
  markRunStarted,
  previewImportCandidateApply = async () => ({
    files: [],
    preview: null,
    summary: { status: 'blocked' },
  }),
  releaseLease,
  replaceImportApplyRunItems = async () => [],
  updateImportApplyRunItem = async () => null,
} = {}) {
  const activeRunIds = new Set();

  async function runApply({ executableCandidateCount, requestedCandidateCount, runId }) {
    let finalLeaseStatus = 'completed';

    try {
      await acquireLease({ runId });
      await markRunStarted({
        runId,
        summary: {
          currentStep: 'Resolving import-pending candidate apply plans',
          executionMode: 'move',
          executableCandidateCount,
          requestedCandidateCount,
        },
      });

      const importPendingSummary = await buildImportPendingCandidateSummary({ limit: 1000 });
      const runItems = buildRunItems(importPendingSummary.importPendingCandidates ?? []);
      await replaceImportApplyRunItems(runId, runItems);

      const counts = {
        applied: 0,
        appliedWithWarnings: 0,
        applyFailed: 0,
        blocked: 0,
      };

      for (const summaryCandidate of importPendingSummary.importPendingCandidates ?? []) {
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
          const applyResult = await applyImportCandidatePreview({
            applyPreview,
            executionMode: 'move',
            importCandidateId: summaryCandidate.id,
            operationRunId: runId,
          });
          const itemStatus = (applyResult.summary.failedFileCount ?? 0) > 0
            ? 'apply_failed'
            : summaryCandidate.importStatus.code === 'ready_with_warnings'
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
            await markImportCandidateApplied({
              importCandidateId: summaryCandidate.id,
              reason: statusMessage,
            });
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
          totalImportPending: importPendingSummary.counts?.totalImportPending ?? runItems.length,
        },
      });
    } catch (error) {
      finalLeaseStatus = 'failed';
      await markRunFailed({
        errorMessage: error.message,
        runId,
        summary: {
          currentStep: 'Import apply failed',
          executionMode: 'move',
          executableCandidateCount,
          requestedCandidateCount,
        },
      });
    } finally {
      activeRunIds.delete(runId);
      await releaseLease({ runId, status: finalLeaseStatus });
    }
  }

  async function startWorkerRun({ executableCandidateCount, requestedCandidateCount, runId }) {
    if (activeRunIds.has(runId)) {
      return;
    }

    activeRunIds.add(runId);
    queueMicrotask(() => {
      void runApply({ executableCandidateCount, requestedCandidateCount, runId });
    });
  }

  return {
    startWorkerRun,
  };
}