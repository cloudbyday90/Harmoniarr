/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const count = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 10_000) : 0;
const publicHandoffFields = new Set(['state', 'dispatchStartedAt', 'retryPolicy', 'providerRespondedAt', 'confirmedAt', 'lastConfirmedAt']);

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
    const handoff = Object.fromEntries(Object.entries(item.planningSnapshot.execution.handoff).filter(([field]) => publicHandoffFields.has(field)));
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
  const references = [];
  const seen = new Set();
  for (const run of [...(value.unconfirmedRuns ?? []), value.currentRun, value.run].filter(Boolean)) {
    for (const item of run.items ?? []) {
      const state = item.planningSnapshot?.execution?.handoff?.state;
      if (state === 'not_dispatched' || (item.downloadReviewRequired !== true && item.itemStatus !== 'awaiting_confirmation' && !['dispatching', 'awaiting_confirmation'].includes(state))) continue;
      const importCandidateId = item.importCandidateId ?? item.planningSnapshot?.candidate?.id;
      if (typeof run.id !== 'string' || typeof importCandidateId !== 'string') continue;
      const key = `${run.id}/${importCandidateId}`;
      if (!seen.has(key) && references.length < 20) { seen.add(key); references.push({ operationRunId: run.id, importCandidateId }); }
    }
  }
  delete projected.unconfirmedRuns;
  if (references.length > 0) {
    projected.downloadAdoptionReviewReferences = references;
    if (value.summary) projected.summary = { ...value.summary, downloadAdoptionReviewReferences: references };
  }
  for (const field of ['activeRun', 'currentRun', 'latestRun', 'run']) {
    if (Object.hasOwn(value, field)) projected[field] = projectRun(value[field]);
  }
  if (Array.isArray(value.recentRuns)) projected.recentRuns = value.recentRuns.map(projectRun);
  return projected;
}
