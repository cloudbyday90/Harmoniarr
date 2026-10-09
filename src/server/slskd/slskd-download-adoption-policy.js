/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createApiError } from '../auth.js';
import { evaluateDownloadReceipt, normalizeDownloadFileManifest, normalizeDownloadReceipt, normalizeDownloadTransferId }
  from './slskd-download-attempt-policy.js';
import { validateSlskdProviderBinding } from './slskd-download-protocol-policy.js';
import { hasProgressedDownloadEvidence } from './slskd-download-evidence-policy.js';

export const MAX_DOWNLOAD_ADOPTION_FILES = 200;
const fail = () => { throw createApiError(409, 'import_execution_download_adoption_evidence_not_current', 'A complete set of current existing downloads could not be verified'); };
const key = (file) => `${file.filename}\u0000${file.size}`;

export function validateDownloadAdoptionSelection({ requestedFiles, username, transferIds, transfers, providerBinding } = {}) {
  const files = normalizeDownloadFileManifest(requestedFiles);
  if (!files || files.length > MAX_DOWNLOAD_ADOPTION_FILES || !validateSlskdProviderBinding(providerBinding)
    || !Array.isArray(transferIds) || transferIds.length !== files.length || !Array.isArray(transfers)) return fail();
  const ids = transferIds.map(normalizeDownloadTransferId);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) return fail();
  const expected = new Set(files.map(key));
  const matching = transfers.filter((row) => typeof row?.filename === 'string'
    && files.some((file) => file.filename === row.filename.trim().replaceAll('/', '\\')));
  // A competing identity or size cannot be silently discarded to make the selection look complete.
  if (matching.length !== files.length) return fail();
  const receipts = [];
  const seen = new Set();
  for (const row of matching) {
    const receipt = normalizeDownloadReceipt(row, username);
    if (!receipt || row.direction !== 'Download' || !ids.includes(receipt.id) || !expected.has(key(receipt))
      || seen.has(key(receipt)) || !hasProgressedDownloadEvidence(row, { allowRemovedSuccess: false })) return fail();
    seen.add(key(receipt));
    receipts.push({ ...receipt, direction: 'Download', state: row.state });
  }
  return { binding: providerBinding, receipts, source: 'operator_adoption', allRequestedFilesMatched: true, requestedFileCount: files.length };
}

/** Only the owning authenticated transaction may persist this separately attributed decision. */
export function createOperatorDownloadAdoptionAttempt({ attempt, providerBinding, transfers, actorUserId, acceptedRequestHash,
  adoptedAt = new Date().toISOString() } = {}) {
  if (!validateSlskdProviderBinding(providerBinding) || typeof actorUserId !== 'string' || !actorUserId
    || !/^[0-9a-f]{64}$/u.test(acceptedRequestHash ?? '') || !Number.isFinite(Date.parse(adoptedAt))) {
    throw new TypeError('Download adoption requires current operator provenance');
  }
  const base = { ...attempt, version: 2, providerBinding, receipts: [], failedFiles: [], receiptOrigin: 'operator_adoption',
    adoption: { actorUserId, acceptedRequestHash, adoptedAt }, originalDispatchUnresolved: true };
  const proof = evaluateDownloadReceipt({ attempt: base, enqueueResult: { enqueued: transfers, failed: [], evidenceOrigin: 'operator_adoption' } });
  if (!proof.allRequestedFilesMatched) return fail();
  return proof;
}
