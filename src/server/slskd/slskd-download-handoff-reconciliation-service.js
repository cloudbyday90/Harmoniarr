/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { evaluateStoredDownloadReceipt, validateDownloadAttempt } from './slskd-download-attempt-policy.js';
import { evaluateBatchDownloadEvidence } from './slskd-download-batch-policy.js';

/** Legacy slskd history cannot attribute a lost POST response to its caller. */
export function createSlskdDownloadHandoffReconciliationService({ getDownloadBatchEvidence = null } = {}) {
  async function findMatchingTransfers(context = {}) {
    let receipt = evaluateStoredDownloadReceipt(context);
    let providerEvidence;
    const saved = validateDownloadAttempt(context);
    if (saved?.version === 2 && saved.providerBinding.protocol === 'batch'
      && saved.receiptOrigin !== 'operator_adoption' && !['confirmed', 'rejected'].includes(receipt?.disposition)
      && typeof getDownloadBatchEvidence === 'function') {
      providerEvidence = await getDownloadBatchEvidence({ attempt: saved });
      receipt = evaluateBatchDownloadEvidence({ attempt: saved, providerEvidence });
    }
    const files = receipt?.attempt?.requestedFiles ?? context.requestedFiles ?? [];
    const confirmed = receipt?.disposition === 'confirmed' && receipt.allRequestedFilesMatched;
    return {
      allRequestedFilesMatched: Boolean(confirmed),
      disposition: receipt?.disposition ?? 'unknown',
      matchedTransfers: confirmed ? receipt.matchedTransfers : [],
      missingFiles: confirmed ? [] : files,
      requestedFileCount: Array.isArray(files) ? files.length : 0,
      attempt: receipt?.attempt ?? null,
      ...(providerEvidence !== undefined ? { providerEvidence } : {}),
    };
  }
  return { findMatchingTransfers };
}
