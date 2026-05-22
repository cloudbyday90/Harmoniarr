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
import {
  isOperationRunCancellationError,
  isOperationRunPauseError,
  throwIfOperationRunCancellationRequested,
} from '../operation-run-cancellation.js';
import { buildOperationResultBreakdown } from '../operation-result-detail-service.js';

function buildMovePlan({ createExclusiveFileMutationPlan, file }) {
  return createExclusiveFileMutationPlan({
    destinationPath: file.proposedPath,
    destinationRoot: file.libraryRootPath,
    requestedMode: 'move',
    sourcePath: file.currentPath,
    sourceRoot: file.libraryRootPath,
  });
}

function buildNotAttemptedFileResult(file) {
  return {
    destinationPath: file.proposedPath ?? null,
    errorMessage: 'A previous file failure stopped processing of remaining files.',
    fileId: file.fileId ?? null,
    filename: basename(file.currentPath ?? file.proposedPath ?? ''),
    sourcePath: file.currentPath ?? null,
    status: 'not_attempted',
    transport: null,
  };
}

function buildReleaseSummary(files) {
  const seen = new Set();
  const releases = [];

  for (const file of files) {
    if (file?.status !== 'moved') {
      continue;
    }

    const artistName = typeof file.artistName === 'string' ? file.artistName : null;
    const releaseTitle = typeof file.releaseTitle === 'string' ? file.releaseTitle : null;
    const dedupeKey = `${artistName ?? ''}::${releaseTitle ?? ''}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    releases.push({ artistName, releaseTitle });
  }

  return {
    count: releases.length,
    primaryArtistName: releases[0]?.artistName ?? null,
    primaryReleaseTitle: releases[0]?.releaseTitle ?? null,
    releases: releases.slice(0, 5),
  };
}

export function createLibraryOrganizeApplyWorker({
  acquireLease,
  applyExclusiveFileMutationPlan,
  buildLibraryOrganizePreview,
  createExclusiveFileMutationPlan,
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  isCancellationRequested,
  markRunPaused,
  markRunCancelled,
  markRunCompleted,
  markRunFailed,
  markRunStarted,
  onReleaseAddedFn = null,
  recordActivityEventFn = null,
  releaseLease,
  renewLease,
  updateLibraryFileCanonicalPath,
} = {}) {
  const activeRunIds = new Set();

  async function notifyOrganizedReleases({ fileResults, movedCount }) {
    if (movedCount < 1) {
      return;
    }

    const releaseSummary = buildReleaseSummary(fileResults);

    if (typeof onReleaseAddedFn === 'function') {
      void onReleaseAddedFn({
        movedCount,
        releaseCount: releaseSummary.count,
        releaseTitle: releaseSummary.primaryReleaseTitle,
        artistName: releaseSummary.primaryArtistName,
      }).catch(() => {});
    }

    if (typeof recordActivityEventFn === 'function') {
      void recordActivityEventFn({
        actorUserId: null,
        entityArtist: releaseSummary.primaryArtistName,
        entityId: null,
        entityTitle: releaseSummary.count > 1
          ? `${releaseSummary.count} releases`
          : releaseSummary.primaryReleaseTitle,
        entityType: 'library_release',
        eventType: 'release_added',
        extraPayload: {
          movedCount,
          releaseCount: releaseSummary.count,
          releaseSummaries: releaseSummary.releases,
        },
      }).catch(() => {});
    }
  }

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
      const fileResults = [];
      let movedCount = 0;

      for (let index = 0; index < filesToMove.length; index += 1) {
        const file = filesToMove[index];
        await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });

        const startedAt = new Date().toISOString();

        try {
          const movePlan = buildMovePlan({ createExclusiveFileMutationPlan, file });
          const result = await applyExclusiveFileMutationPlan(movePlan);

          await updateLibraryFileCanonicalPath({
            canonicalPath: file.proposedPath,
            fileId: file.fileId,
            filename: basename(file.proposedPath),
            relativePath: file.proposedRelativePath,
          });

          movedCount += 1;

          fileResults.push({
            artistName: file.match?.artistName ?? null,
            destinationPath: file.proposedPath,
            errorMessage: null,
            fileId: file.fileId ?? null,
            filename: basename(file.proposedPath),
            releaseTitle: file.match?.releaseTitle ?? null,
            sourcePath: file.currentPath,
            startedAt,
            status: 'moved',
            transport: result.transport,
            verification: result.verification ?? null,
          });

          await markRunStarted({
            runId,
            summary: {
              currentStep: `Applied ${movedCount} of ${filesToMove.length} organize changes`,
              fileResults,
              latestTransport: result.transport,
              movedCount,
              plannedRenameCount: filesToMove.length,
            },
          });
        } catch (fileError) {
          fileResults.push({
            artistName: file.match?.artistName ?? null,
            destinationPath: file.proposedPath ?? null,
            errorMessage: fileError instanceof Error ? fileError.message : String(fileError),
            fileId: file.fileId ?? null,
            filename: basename(file.currentPath ?? file.proposedPath ?? ''),
            releaseTitle: file.match?.releaseTitle ?? null,
            sourcePath: file.currentPath ?? null,
            startedAt,
            status: 'failed',
            transport: null,
          });

          for (let remainingIndex = index + 1; remainingIndex < filesToMove.length; remainingIndex += 1) {
            fileResults.push(buildNotAttemptedFileResult(filesToMove[remainingIndex]));
          }

          const breakdown = buildOperationResultBreakdown(fileResults);

          await markRunCompleted({
            runId,
            summary: {
              ...breakdown,
              fileResults,
              movedCount,
              plannedRenameCount: filesToMove.length,
              skippedCount: Math.max((organizePreview.counts?.totalFiles ?? filesToMove.length) - filesToMove.length, 0),
            },
          });
          await notifyOrganizedReleases({ fileResults, movedCount });
          return;
        }
      }

      const breakdown = buildOperationResultBreakdown(fileResults);

      await markRunCompleted({
        runId,
        summary: {
          ...breakdown,
          fileResults,
          movedCount,
          plannedRenameCount: filesToMove.length,
          skippedCount: Math.max((organizePreview.counts?.totalFiles ?? filesToMove.length) - filesToMove.length, 0),
        },
      });
      await notifyOrganizedReleases({ fileResults, movedCount });
    } catch (error) {
      if (isOperationRunPauseError(error)) {
        finalLeaseStatus = 'paused';
        await markRunPaused({
          nextAttemptAt: error.nextRetryAt ?? null,
          runId,
          summary: {
            currentStep: 'Library organize apply paused by maintenance lock',
            pauseCode: error.pauseCode ?? null,
            pauseMessage: error.message,
            pauseProvider: error.pauseProvider ?? null,
            plannedRenameCount,
          },
        });
        return;
      }

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
