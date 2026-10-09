/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const count = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 10_000) : 0;

function projectConfirmation(confirmation) {
  if (!confirmation) return confirmation;
  const disposition = ['confirmed', 'partial', 'rejected', 'unknown'].includes(confirmation.disposition) ? confirmation.disposition : 'unknown';
  return { disposition, allRequestedFilesMatched: disposition === 'confirmed' && confirmation.allRequestedFilesMatched === true,
    checkedAt: confirmation.checkedAt ?? null, requestedFileCount: count(confirmation.requestedFileCount),
    matchedTransferCount: count(confirmation.attempt?.receipts?.length ?? confirmation.matchedTransfers?.length), providerUnavailable: confirmation.providerUnavailable === true };
}

function projectItem(item) {
  const projected = { ...item };
  delete projected.transferObservationPending;
  if (item.handoffConfirmation) projected.handoffConfirmation = projectConfirmation(item.handoffConfirmation);
  if (item.planningSnapshot?.execution?.handoff) {
    const handoff = { ...item.planningSnapshot.execution.handoff };
    delete handoff.attempt;
    projected.planningSnapshot = { ...item.planningSnapshot, execution: { ...item.planningSnapshot.execution, handoff } };
  }
  return projected;
}

function projectRun(run) {
  return run ? { ...run, ...(Array.isArray(run.items) ? { items: run.items.map(projectItem) } : {}) } : run;
}

/** API projection only: heartbeat/reconciliation retain their full internal checkpoints. */
export function buildPublicImportCandidateExecution(value) {
  if (!value) return value;
  const projected = { ...value };
  delete projected.unconfirmedRuns;
  for (const field of ['activeRun', 'currentRun', 'latestRun', 'run']) {
    if (Object.hasOwn(value, field)) projected[field] = projectRun(value[field]);
  }
  if (Array.isArray(value.recentRuns)) projected.recentRuns = value.recentRuns.map(projectRun);
  return projected;
}
