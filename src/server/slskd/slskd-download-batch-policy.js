/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { evaluateDownloadReceipt, normalizeDownloadFileManifest, normalizeDownloadReceipt, normalizeDownloadTransferId, validateDownloadAttempt }
  from './slskd-download-attempt-policy.js';
import { hasKnownDownloadState, hasProgressedDownloadEvidence, hasProviderRestartEvidence } from './slskd-download-evidence-policy.js';
import { normalizeSlskdDownloadTransfer } from './slskd-download-transfer-policy.js';

const fileKey = (file) => `${file.filename}\u0000${file.size}`;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function decodeSlskdDownloadBatch({ attempt, payload } = {}) {
  const files = normalizeDownloadFileManifest(attempt?.requestedFiles);
  const id = normalizeDownloadTransferId(payload?.id);
  if (!files || !object(payload) || id !== normalizeDownloadTransferId(attempt?.attemptId)
    || payload.username !== attempt.username || payload.direction !== 'Download'
    || !Array.isArray(payload.transfers) || payload.transfers.length > files.length
    || (payload.options != null && !object(payload.options))
    || payload.searchId != null || payload.options?.destination != null || payload.options?.externalId != null) return null;
  const expected = new Set(files.map(fileKey));
  const ids = new Set();
  const keys = new Set();
  const transfers = [];
  for (const row of payload.transfers) {
    const receipt = normalizeDownloadReceipt(row, attempt.username);
    const batchId = normalizeDownloadTransferId(row?.batchId);
    if (!receipt || row.direction !== 'Download' || batchId !== id || !expected.has(fileKey(receipt))
      || ids.has(receipt.id) || keys.has(fileKey(receipt)) || !hasKnownDownloadState(row)
      || (row.exception != null && typeof row.exception !== 'string')
      || (row.removed != null && typeof row.removed !== 'boolean')) return null;
    ids.add(receipt.id);
    keys.add(fileKey(receipt));
    transfers.push({ ...normalizeSlskdDownloadTransfer(row), ...receipt, batchId });
  }
  return { id, transfers, requestedFiles: files };
}

/** The explicit POST's failure list is part of admission evidence, not a count hint. */
export function decodeSlskdDownloadBatchResponse({ attempt, payload } = {}) {
  const batch = decodeSlskdDownloadBatch({ attempt, payload: payload?.batch });
  const failed = [];
  if (!batch || !object(payload) || !Array.isArray(payload.failures)
    || payload.failures.length > batch.requestedFiles.length) return { enqueued: [], failed: [], receiptMalformed: true };
  const expected = new Set(batch.requestedFiles.map((file) => file.filename));
  for (const failure of payload.failures) {
    if (!object(failure) || typeof failure.filename !== 'string' || typeof failure.message !== 'string') return { enqueued: [], failed: [], receiptMalformed: true };
    const filename = failure.filename.trim().replaceAll('/', '\\');
    if (!expected.has(filename) || failed.includes(filename)) return { enqueued: [], failed: [], receiptMalformed: true };
    failed.push(filename);
  }
  // A failed scheduling attempt can still leave an owned DB row; it is not Enqueued.
  const enqueued = batch.transfers.filter((row) => !failed.includes(row.filename));
  if (batch.transfers.some(hasProviderRestartEvidence)) return { enqueued: [], failed: [], receiptMalformed: true };
  if (enqueued.length + failed.length !== batch.requestedFiles.length) return { enqueued: [], failed: [], receiptMalformed: true };
  return { enqueued, failed, evidenceOrigin: 'direct_response' };
}

/** Whole progressed, caller-owned records can recover a lost response without another POST. */
export function decodeSlskdDownloadBatchEvidence({ attempt, payload } = {}) {
  const batch = decodeSlskdDownloadBatch({ attempt, payload });
  if (!batch) return { enqueued: [], failed: [], receiptMalformed: true, evidenceOrigin: 'batch_lookup' };
  const enqueued = batch.transfers.filter((row) => hasProgressedDownloadEvidence(row));
  return { enqueued, failed: [], evidenceOrigin: 'batch_lookup' };
}

export function evaluateBatchDownloadEvidence({ attempt, providerEvidence } = {}) {
  const saved = validateDownloadAttempt({ attempt, importCandidateId: attempt?.importCandidateId,
    operationRunId: attempt?.operationRunId, requestedFiles: attempt?.requestedFiles, username: attempt?.username });
  if (!saved || saved.version !== 2 || saved.providerBinding.protocol !== 'batch') return null;
  return evaluateDownloadReceipt({ attempt: saved, enqueueResult: decodeSlskdDownloadBatchEvidence({ attempt: saved, payload: providerEvidence }) });
}
