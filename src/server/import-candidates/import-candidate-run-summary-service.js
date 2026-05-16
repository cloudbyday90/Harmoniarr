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

import { createApiError } from '../auth.js';

export function createImportCandidateRunSummaryService({
  buildDisplayRunSummary,
  buildRunWithItems = async (run) => run,
  extendSummary = async () => ({}),
  runNotFoundCode,
  runNotFoundMessage,
  runStore,
} = {}) {
  if (typeof buildDisplayRunSummary !== 'function') {
    throw new Error('createImportCandidateRunSummaryService requires buildDisplayRunSummary');
  }

  if (!runStore) {
    throw new Error('createImportCandidateRunSummaryService requires runStore');
  }

  async function buildRunSummary() {
    const checkedAt = new Date().toISOString();
    const [activeRun, latestRun, recentRuns] = await Promise.all([
      runStore.getActiveRun(),
      runStore.getLatestRun(),
      runStore.listRecentRuns?.({ limit: 5 }) ?? [],
    ]);
    const currentRun = await buildRunWithItems(activeRun ?? latestRun);

    return {
      activeRun,
      checkedAt,
      currentRun,
      latestRun,
      recentRuns,
      summary: buildDisplayRunSummary(currentRun),
      ...await extendSummary({
        activeRun,
        checkedAt,
        currentRun,
        latestRun,
        recentRuns,
      }),
    };
  }

  async function buildRunDetail({ runId }) {
    const run = await runStore.getRunById(runId);

    if (!run) {
      throw createApiError(404, runNotFoundCode, runNotFoundMessage);
    }

    return {
      checkedAt: new Date().toISOString(),
      run: await buildRunWithItems(run),
    };
  }

  return {
    buildRunDetail,
    buildRunSummary,
  };
}
