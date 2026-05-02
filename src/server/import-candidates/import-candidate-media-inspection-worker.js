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
import { isOperationRunCancellationError, throwIfOperationRunCancellationRequested } from '../operation-run-cancellation.js';

function summarizeInspection(files = []) {
  const inspectionWarnings = files.flatMap((file) => file?.inspection?.warnings ?? []);

  return {
    fileCount: files.length,
    inspectionUnavailableCount: inspectionWarnings.filter((warning) => (
      warning?.code === 'media_inspection_unavailable'
      || warning?.code === 'media_inspection_probe_failed'
    )).length,
    warningCount: inspectionWarnings.length,
  };
}

export function createImportCandidateMediaInspectionWorker({
  acquireLease,
  buildSelectedImportCandidateSummary = async () => ({
    selectedCandidates: [],
  }),
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  isCancellationRequested,
  markRunCancelled,
  markRunCompleted,
  markRunFailed,
  markRunStarted,
  previewImportCandidateApply = async () => ({ files: [] }),
  releaseLease,
  renewLease,
} = {}) {
  const activeRunIds = new Set();

  async function runInspection({ requestedCandidateCount, runId }) {
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
          currentStep: 'Inspecting selected import candidate media',
          requestedCandidateCount,
        },
      });

      const selectedSummary = await buildSelectedImportCandidateSummary({ limit: 1000 });
      const counters = {
        blockedCandidateCount: 0,
        inspectedCandidateCount: 0,
        inspectedFileCount: 0,
        inspectionUnavailableCount: 0,
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
        const inspectionSummary = summarizeInspection(applyPreview.files ?? []);

        counters.inspectedCandidateCount += 1;
        counters.inspectedFileCount += inspectionSummary.fileCount;
        counters.inspectionUnavailableCount += inspectionSummary.inspectionUnavailableCount;
        counters.warningCount += inspectionSummary.warningCount;
      }

      await markRunCompleted({
        runId,
        summary: {
          blockedCandidateCount: counters.blockedCandidateCount,
          currentStep: 'Media inspection complete',
          inspectedCandidateCount: counters.inspectedCandidateCount,
          inspectedFileCount: counters.inspectedFileCount,
          inspectionUnavailableCount: counters.inspectionUnavailableCount,
          requestedCandidateCount,
          warningCount: counters.warningCount,
        },
      });
    } catch (error) {
      if (isOperationRunCancellationError(error)) {
        finalLeaseStatus = 'cancelled';
        await markRunCancelled({
          runId,
          summary: {
            currentStep: 'Media inspection cancelled',
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
          currentStep: 'Media inspection failed',
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
      void runInspection({ requestedCandidateCount, runId });
    });
  }

  return {
    startWorkerRun,
  };
}
