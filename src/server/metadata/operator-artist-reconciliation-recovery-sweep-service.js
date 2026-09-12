/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0. See LICENSE for details.
 */

import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';
import { createOperatorArtistReconciliationRecoveryStore } from './operator-artist-reconciliation-recovery-store.js';

const operationType = operationRunRegistry.operatorArtistReconciliation.operationType;

/** Called only by the dispatcher after its maintenance-readiness check. */
export function createOperatorArtistReconciliationRecoverySweepService({
  recoveryStore = createOperatorArtistReconciliationRecoveryStore(),
  getNow = Date.now,
} = {}) {
  let nextScanAt = 0;
  let running = false;
  async function recoverFailedRuns({ operationTypes = [] } = {}) {
    const now = getNow();
    if (!operationTypes.includes(operationType) || running || now < nextScanAt) {
      return { scannedCount: 0, recoveredCount: 0, skipped: true };
    }
    running = true;
    nextScanAt = now + 60_000;
    try {
      const candidates = await recoveryStore.listCandidates({ limit: 10 });
      let recoveredCount = 0;
      const errors = [];
      for (const candidate of candidates) {
        try {
          const result = await recoveryStore.recoverCandidate(candidate);
          if (result.recovered) recoveredCount += 1;
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) throw new AggregateError(errors, 'Some artist reconciliation recovery candidates failed');
      return { scannedCount: candidates.length, recoveredCount, skipped: false };
    } finally {
      running = false;
    }
  }
  return { recoverFailedRuns };
}
