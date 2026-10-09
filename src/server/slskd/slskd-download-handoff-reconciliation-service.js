/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { evaluateStoredDownloadReceipt } from './slskd-download-attempt-policy.js';

/** Legacy slskd history cannot attribute a lost POST response to its caller. */
export function createSlskdDownloadHandoffReconciliationService() {
  async function findMatchingTransfers(context = {}) {
    const receipt = evaluateStoredDownloadReceipt(context);
    const files = receipt?.attempt?.requestedFiles ?? context.requestedFiles ?? [];
    const confirmed = receipt?.disposition === 'confirmed' && receipt.allRequestedFilesMatched;
    return {
      allRequestedFilesMatched: Boolean(confirmed),
      disposition: receipt?.disposition ?? 'unknown',
      matchedTransfers: confirmed ? receipt.matchedTransfers : [],
      missingFiles: confirmed ? [] : files,
      requestedFileCount: Array.isArray(files) ? files.length : 0,
      attempt: receipt?.attempt ?? null,
    };
  }
  return { findMatchingTransfers };
}
