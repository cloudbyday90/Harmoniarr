/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { MAX_UNCONFIRMED_EXECUTION_RUNS } from './import-candidate-execution-confirmation-worklist-store.js';
import { isUnconfirmedExecutionItem } from './import-candidate-execution-handoff-state.js';

const count = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 10_000) : 0;

export function createImportCandidateExecutionConfirmationWorklistService({
  listUnconfirmedExecutionRuns = async () => ({ runIds: [], pendingConfirmationCount: 0 }),
  getRunById = async () => null, buildRunWithItems,
} = {}) {
  if (typeof buildRunWithItems !== 'function') throw new TypeError('Confirmation worklist requires buildRunWithItems');
  async function buildExecutionConfirmationWorklist({ currentRun = null } = {}) {
    const result = await listUnconfirmedExecutionRuns({ excludeRunId: currentRun?.id ?? null, limit: MAX_UNCONFIRMED_EXECUTION_RUNS });
    const runIds = [...new Set(result.runIds ?? [])].filter((id) => typeof id === 'string' && id && id !== currentRun?.id)
      .slice(0, MAX_UNCONFIRMED_EXECUTION_RUNS);
    const unconfirmedRuns = [];
    for (const id of runIds) {
      const run = await getRunById(id);
      if (run?.executionMode === 'download_enqueue') {
        const hydrated = await buildRunWithItems(run);
        const items = (hydrated?.items ?? []).filter(isUnconfirmedExecutionItem);
        if (items.length > 0) unconfirmedRuns.push({ ...hydrated, items });
      }
    }
    const currentCount = (currentRun?.items ?? []).filter(isUnconfirmedExecutionItem).length;
    const observedOlderCount = unconfirmedRuns.reduce((total, run) => total + run.items.length, 0);
    const pendingConfirmationCount = count(Math.max(count(result.pendingConfirmationCount), observedOlderCount) + currentCount);
    return { unconfirmedRuns, pendingConfirmationCount, confirmationPending: pendingConfirmationCount > 0 };
  }
  return { buildExecutionConfirmationWorklist };
}
