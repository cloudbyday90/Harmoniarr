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

import { basename } from 'node:path';
import { createOperationRunLeaseHeartbeat } from '../heartbeat/operation-run-lease-heartbeat.js';
import { isOperationRunCancellationError, throwIfOperationRunCancellationRequested } from '../operation-run-cancellation.js';

function buildMovePlan({ createExclusiveFileMutationPlan, file }) {
  return createExclusiveFileMutationPlan({
    destinationPath: file.proposedPath,
    destinationRoot: file.libraryRootPath,
    requestedMode: 'move',
    sourcePath: file.currentPath,
    sourceRoot: file.libraryRootPath,
  });
}

export function createLibraryOrganizeApplyWorker({
  acquireLease,
  applyExclusiveFileMutationPlan,
  buildLibraryOrganizePreview,
  createExclusiveFileMutationPlan,
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  isCancellationRequested,
  markRunCancelled,
  markRunCompleted,
  markRunFailed,
  markRunStarted,
  releaseLease,
  renewLease,
  updateLibraryFileCanonicalPath,
} = {}) {
  const activeRunIds = new Set();

  async function runOrganizeApply({ plannedRenameCount = null, runId }) {
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
          currentStep: 'Preparing library organize apply plan',
          plannedRenameCount,
        },
      });

      const organizePreview = await buildLibraryOrganizePreview();
      const filesToMove = (organizePreview.files ?? []).filter((file) => file.status?.code === 'rename_required');
      let movedCount = 0;

      for (const file of filesToMove) {
        await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });

        const movePlan = buildMovePlan({
          createExclusiveFileMutationPlan,
          file,
        });
        const result = await applyExclusiveFileMutationPlan(movePlan);

        await updateLibraryFileCanonicalPath({
          canonicalPath: file.proposedPath,
          fileId: file.fileId,
          filename: basename(file.proposedPath),
          relativePath: file.proposedRelativePath,
        });

        movedCount += 1;

        await markRunStarted({
          runId,
          summary: {
            currentStep: `Applied ${movedCount} of ${filesToMove.length} organize changes`,
            latestTransport: result.transport,
            movedCount,
            plannedRenameCount: filesToMove.length,
          },
        });
      }

      await markRunCompleted({
        runId,
        summary: {
          movedCount,
          plannedRenameCount: filesToMove.length,
          skippedCount: Math.max((organizePreview.counts?.totalFiles ?? filesToMove.length) - filesToMove.length, 0),
        },
      });
    } catch (error) {
      if (isOperationRunCancellationError(error)) {
        finalLeaseStatus = 'cancelled';
        await markRunCancelled({
          runId,
          summary: {
            currentStep: 'Library organize apply cancelled',
            plannedRenameCount,
          },
        });
        return;
      }

      finalLeaseStatus = 'failed';
      await markRunFailed({
        runId,
        errorMessage: error.message,
        summary: {
          plannedRenameCount,
        },
      });
    } finally {
      leaseHeartbeat?.stop();
      activeRunIds.delete(runId);
      await releaseLease({ runId, status: finalLeaseStatus });
    }
  }

  async function startWorkerRun({ plannedRenameCount = null, runId }) {
    if (activeRunIds.has(runId)) {
      return;
    }

    activeRunIds.add(runId);
    queueMicrotask(() => {
      void runOrganizeApply({ plannedRenameCount, runId });
    });
  }

  return {
    startWorkerRun,
  };
}
