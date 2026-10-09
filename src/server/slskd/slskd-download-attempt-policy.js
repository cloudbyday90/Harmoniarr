/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { randomUUID } from 'node:crypto';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const maximumFiles = 10000;

function text(value, maximumLength = 4096) {
  return typeof value === 'string' && value.trim() && value.length <= maximumLength
    && !value.includes('\u0000') ? value.trim() : null;
}

function fileIdentity(file) {
  const filename = text(file?.filename)?.replaceAll('/', '\\');
  return filename && Number.isSafeInteger(file?.size) && file.size > 0
    ? { filename, size: file.size } : null;
}

function fileKey(file) { return `${file.filename}\u0000${file.size}`; }

export function normalizeDownloadTransferId(value) {
  const id = text(value, 128);
  return id && uuidPattern.test(id) ? id.toLowerCase() : null;
}

function manifest(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > maximumFiles) return null;
  const normalized = files.map(fileIdentity);
  if (normalized.some((file) => !file)) return null;
  if (new Set(normalized.map((file) => file.filename)).size !== normalized.length) return null;
  return normalized;
}

function sameManifest(left, right) {
  return left.length === right.length
    && left.every((file, index) => fileKey(file) === fileKey(right[index]));
}

function receiptIdentity(transfer, username) {
  const file = fileIdentity(transfer);
  const id = normalizeDownloadTransferId(transfer?.id);
  const peer = text(transfer?.username, 256);
  const direction = !Object.hasOwn(transfer ?? {}, 'direction')
    || transfer.direction === 'Download';
  return direction && file && id && peer === username
    ? { ...file, id, username: peer } : null;
}

export function matchesDownloadReceipt({ receipt, transfer } = {}) {
  const expected = receiptIdentity(receipt, receipt?.username);
  const observed = receiptIdentity(transfer, receipt?.username);
  return Boolean(expected && observed && expected.id === observed.id
    && fileKey(expected) === fileKey(observed));
}

export function createDownloadAttempt({
  attemptId = randomUUID(), importCandidateId, operationRunId,
  requestedFiles, sourceObservation, username,
} = {}) {
  const files = manifest(requestedFiles);
  const peer = text(username, 256);
  if (!uuidPattern.test(attemptId) || !text(importCandidateId, 128)
    || !text(operationRunId, 128) || !files || !peer
    || !sourceObservation || typeof sourceObservation !== 'object'
    || Array.isArray(sourceObservation)) {
    throw new TypeError('A download attempt requires an owner, source and unique valid file manifest');
  }
  return {
    version: 1, attemptId, importCandidateId, operationRunId,
    requestedFiles: files, username: peer,
    sourceObservation: structuredClone(sourceObservation), receipts: [], failedFiles: [],
  };
}

/** Validate saved receipts in their owning run/item; never infer ownership from history. */
export function validateDownloadAttempt({
  attempt, importCandidateId, operationRunId, requestedFiles, username,
} = {}) {
  if (attempt?.version !== 1 || !uuidPattern.test(attempt?.attemptId ?? '')
    || attempt.importCandidateId !== importCandidateId || attempt.operationRunId !== operationRunId
    || !text(importCandidateId, 128) || !text(operationRunId, 128)
    || text(username, 256) !== attempt.username
    || !attempt.sourceObservation || typeof attempt.sourceObservation !== 'object'
    || Array.isArray(attempt.sourceObservation)) return null;
  const files = manifest(attempt.requestedFiles);
  const expected = manifest(requestedFiles);
  if (!files || !expected || !sameManifest(files, expected)
    || !Array.isArray(attempt.receipts) || attempt.receipts.length > files.length
    || !Array.isArray(attempt.failedFiles) || attempt.failedFiles.length > files.length) return null;
  const receipts = attempt.receipts.map((row) => receiptIdentity(row, attempt.username));
  const keys = new Set(files.map(fileKey));
  if (receipts.some((row) => !row || !keys.has(fileKey(row)))
    || new Set(receipts.map((row) => row.id)).size !== receipts.length
    || new Set(receipts.map(fileKey)).size !== receipts.length) return null;
  const failedFiles = attempt.failedFiles.map((name) => text(name)?.replaceAll('/', '\\'));
  const filenames = new Set(files.map((file) => file.filename));
  if (new Set(failedFiles).size !== failedFiles.length
    || failedFiles.some((name) => !name || !filenames.has(name)
      || receipts.some((receipt) => receipt.filename === name))) return null;
  return { ...attempt, requestedFiles: files, receipts, failedFiles };
}

/** Classify the actual POST response; positive counts and HTTP success are insufficient. */
export function evaluateDownloadReceipt({ attempt, enqueueResult } = {}) {
  const saved = validateDownloadAttempt({ attempt,
    importCandidateId: attempt?.importCandidateId, operationRunId: attempt?.operationRunId,
    requestedFiles: attempt?.requestedFiles, username: attempt?.username,
  });
  if (!saved) throw new TypeError('Cannot attach a receipt to an invalid download attempt');
  const requestedByKey = new Map(saved.requestedFiles.map((file) => [fileKey(file), file]));
  const requestedByFilename = new Set(saved.requestedFiles.map((file) => file.filename));
  let malformed = !Array.isArray(enqueueResult?.enqueued) || !Array.isArray(enqueueResult?.failed)
    || enqueueResult?.receiptMalformed === true;
  const enqueued = Array.isArray(enqueueResult?.enqueued) ? enqueueResult.enqueued : [];
  const failed = Array.isArray(enqueueResult?.failed) ? enqueueResult.failed : [];
  if (enqueued.length > saved.requestedFiles.length || failed.length > saved.requestedFiles.length) malformed = true;
  const receipts = [];
  const matchedTransfers = [];
  const receiptIds = new Set();
  const receiptKeys = new Set();
  for (const transfer of enqueued.slice(0, saved.requestedFiles.length)) {
    const receipt = receiptIdentity(transfer, saved.username);
    const key = receipt && fileKey(receipt);
    if (!receipt || !requestedByKey.has(key) || receiptIds.has(receipt.id) || receiptKeys.has(key)) {
      malformed = true;
      continue;
    }
    receiptIds.add(receipt.id);
    receiptKeys.add(key);
    receipts.push(receipt);
    matchedTransfers.push({ ...transfer, ...receipt });
  }
  const failedNames = failed.slice(0, saved.requestedFiles.length).map((name) => text(name)?.replaceAll('/', '\\'));
  if (new Set(failedNames).size !== failedNames.length
    || failedNames.some((name) => !name || !requestedByFilename.has(name)
      || receipts.some((receipt) => receipt.filename === name))) malformed = true;
  const allRequestedFilesMatched = !malformed && failedNames.length === 0
    && receipts.length === saved.requestedFiles.length;
  const disposition = allRequestedFilesMatched ? 'confirmed'
    : !malformed && receipts.length === 0 && failedNames.length === saved.requestedFiles.length ? 'rejected'
      : !malformed && receipts.length > 0 ? 'partial' : 'unknown';
  // Contradictory rows cannot reserve an arbitrary first identity in the link ledger.
  if (malformed) {
    receipts.length = 0;
    matchedTransfers.length = 0;
    receiptKeys.clear();
  }
  return {
    allRequestedFilesMatched, disposition, matchedTransfers,
    missingFiles: saved.requestedFiles.filter((file) => !receiptKeys.has(fileKey(file))),
    requestedFileCount: saved.requestedFiles.length,
    attempt: { ...saved, receipts, receiptDisposition: disposition,
      failedFiles: malformed ? [] : [...new Set(failedNames.filter((name) => name && requestedByFilename.has(name)
        && !receipts.some((receipt) => receipt.filename === name)))],
    },
  };
}

export function evaluateStoredDownloadReceipt(context = {}) {
  const attempt = validateDownloadAttempt(context);
  if (!attempt) return null;
  const result = evaluateDownloadReceipt({ attempt, enqueueResult: {
    enqueued: attempt.receipts, failed: attempt.failedFiles,
  } });
  // A malformed direct response cannot be upgraded after its rejected rows are omitted.
  if (result.disposition !== attempt.receiptDisposition) {
    return { ...result, attempt, allRequestedFilesMatched: false, disposition: 'unknown', matchedTransfers: [] };
  }
  return { ...result, attempt };
}
