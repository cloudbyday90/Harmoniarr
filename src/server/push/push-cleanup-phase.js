/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function createPushCleanupSummary(reason) {
  return { deletedCount: 0, batchesCompleted: 0, batchLimitReached: false, skipped: true,
    ...(reason ? { reason } : {}) };
}

/** Run one bounded cleanup phase, reporting only confirmed database counts. */
export async function runBoundedCleanupPhase({ deleteBatch, batchLimit, maxBatches, shouldStop, onError }) {
  const summary = createPushCleanupSummary();
  try {
    for (let index = 0; index < maxBatches; index += 1) {
      if (shouldStop()) return { ...summary, reason: 'stopped' };
      const result = await deleteBatch({ limit: batchLimit });
      if (!Number.isSafeInteger(result?.deletedCount) || result.deletedCount < 0 || result.deletedCount > batchLimit) {
        throw new Error('Push cleanup returned an invalid count');
      }
      summary.deletedCount += result.deletedCount;
      summary.batchesCompleted += 1;
      summary.skipped = false;
      if (result.deletedCount < batchLimit) return summary;
    }
    return { ...summary, batchLimitReached: true };
  } catch {
    // Never expose a database error or let a diagnostic sink reject the tick.
    try {
      const result = onError();
      if (typeof result?.catch === 'function') result.catch(() => {});
    } catch { /* Confirmed partial counts remain available even if diagnostics fail. */ }
    return { ...summary, reason: 'error' };
  }
}
