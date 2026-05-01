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

import { listImportApplyRunItems } from './import-candidate-apply-repository.js';
import { listImportOperations } from './import-candidate-operation-repository.js';
import { createImportCandidateApplyRunStore } from './import-candidate-apply-run-store.js';

function groupImportOperationsByCandidateId(importOperations) {
  return importOperations.reduce((grouped, operation) => {
    const candidateId = operation.importCandidateId;
    if (!candidateId) {
      return grouped;
    }

    const candidateOperations = grouped.get(candidateId) ?? [];
    candidateOperations.push(operation);
    grouped.set(candidateId, candidateOperations);
    return grouped;
  }, new Map());
}

function buildDisplayRunSummary(run) {
  if (!run) {
    return {
      message: 'No import apply run has been recorded yet.',
      status: 'not_started',
    };
  }

  if (run.status === 'pending' || run.status === 'running') {
    return {
      message: run.currentStep || 'Import apply is in progress.',
      status: 'running',
    };
  }

  if (run.status === 'failed') {
    return {
      message: run.errorMessage
        ? `The latest import apply run failed: ${run.errorMessage}`
        : 'The latest import apply run failed.',
      status: 'failed',
    };
  }

  if ((run.applyFailedCount ?? 0) > 0) {
    return {
      message: `${run.applyFailedCount} candidate${run.applyFailedCount === 1 ? '' : 's'} encountered an import apply failure and need operator attention.`,
      status: 'failed',
    };
  }

  if ((run.blockedCount ?? 0) > 0) {
    return {
      message: `${run.blockedCount} import-pending candidate${run.blockedCount === 1 ? '' : 's'} remained blocked and were not applied.`,
      status: 'blocked',
    };
  }

  if ((run.appliedWithWarningsCount ?? 0) > 0) {
    return {
      message: `${run.appliedWithWarningsCount} candidate${run.appliedWithWarningsCount === 1 ? ' was' : 's were'} applied with warnings.`,
      status: 'attention',
    };
  }

  return {
    message: `${run.appliedCount ?? 0} candidate${run.appliedCount === 1 ? ' was' : 's were'} applied into the library.`,
    status: 'ready',
  };
}

export function createImportCandidateApplySummaryService({
  importCandidateApplyRunStore = createImportCandidateApplyRunStore(),
  listImportApplyRunItemsFn = listImportApplyRunItems,
  listImportOperationsFn = listImportOperations,
} = {}) {
  async function buildRunWithItems(run) {
    if (!run) {
      return null;
    }

    const [items, importOperations] = await Promise.all([
      listImportApplyRunItemsFn(run.id),
      listImportOperationsFn({ operationRunId: run.id }),
    ]);
    const operationsByCandidateId = groupImportOperationsByCandidateId(importOperations);

    return {
      ...run,
      items: items.map((item) => ({
        ...item,
        importOperations: operationsByCandidateId.get(item.importCandidateId) ?? [],
      })),
    };
  }

  async function buildImportCandidateApplySummary() {
    const checkedAt = new Date().toISOString();
    const [activeRun, latestRun] = await Promise.all([
      importCandidateApplyRunStore.getActiveRun(),
      importCandidateApplyRunStore.getLatestRun(),
    ]);
    const currentRun = await buildRunWithItems(activeRun ?? latestRun);

    return {
      activeRun,
      checkedAt,
      currentRun,
      latestRun,
      summary: buildDisplayRunSummary(currentRun),
    };
  }

  return {
    buildImportCandidateApplySummary,
  };
}