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

import { executeLibraryScan } from './library-scan-executor.js';

export function createLibraryScanWorker({
  acquireLease,
  executeScan = executeLibraryScan,
  extractLibraryFileTags = null,
  matchLibraryFiles = null,
  markRunCompleted,
  markRunFailed,
  markRunStarted,
  reconcileDiscoveryRequests = null,
  reconcileLibraryReleases = null,
  reconcileWantedReleases = null,
  recordLibraryFiles = null,
  releaseLease,
} = {}) {
  const activeRunIds = new Set();

  async function runScan({ libraryRoot, runId }) {
    let finalLeaseStatus = 'completed';

    try {
      await acquireLease({ runId });
      await markRunStarted({
        runId,
        summary: {
          libraryRoot,
        },
      });

      const observedFiles = [];
      const summary = await executeScan({
        libraryRoot,
        onFile: async (file) => {
          observedFiles.push(file);
        },
      });

      let catalogResult = null;
      if (recordLibraryFiles) {
        catalogResult = await recordLibraryFiles({
          files: observedFiles,
          libraryRootPath: summary.libraryRoot,
        });
      }

      if (extractLibraryFileTags && catalogResult?.files?.length) {
        await extractLibraryFileTags({
          files: catalogResult.files,
        });
      }

      if (matchLibraryFiles && catalogResult?.files?.length) {
        await matchLibraryFiles({
          files: catalogResult.files,
        });
      }

      if (reconcileLibraryReleases) {
        await reconcileLibraryReleases();
      }

      if (reconcileWantedReleases) {
        await reconcileWantedReleases();
      }

      if (reconcileDiscoveryRequests) {
        await reconcileDiscoveryRequests();
      }

      await markRunCompleted({ runId, summary });
    } catch (error) {
      finalLeaseStatus = 'failed';
      await markRunFailed({
        runId,
        errorMessage: error.message,
        summary: {
          libraryRoot,
        },
      });
    } finally {
      activeRunIds.delete(runId);
      await releaseLease({ runId, status: finalLeaseStatus });
    }
  }

  async function startWorkerRun({ libraryRoot, runId }) {
    if (activeRunIds.has(runId)) {
      return;
    }

    activeRunIds.add(runId);
    queueMicrotask(() => {
      void runScan({ libraryRoot, runId });
    });
  }

  return {
    startWorkerRun,
  };
}