/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { isSupportedOperatorTrackScope } from '../metadata/operator-track-scope-policy.js';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(value);
export function currentScanReceiptSource(source, context) {
  const current = { ...source };
  if (context.operationType !== 'library_scan' || current.negativeScanRunId !== context.runId
    || !current.negativeScanAcquisitionId || current.negativeScanAcquisitionId !== context.expectedLease?.acquisitionId) delete current.negativeScanRunId;
  delete current.negativeScanAcquisitionId;
  return current;
}
export const scanReceiptPathKey = value => process.platform === 'win32' ? resolve(value).toLowerCase() : resolve(value);
export const sameScanReceiptPath = (a, b) => typeof a === 'string' && typeof b === 'string'
  && scanReceiptPathKey(a) === scanReceiptPathKey(b);
export function withinScanReceiptRoot(file, root) {
  if (typeof file !== 'string' || typeof root !== 'string' || file.includes('\u0000') || root.includes('\u0000')
    || file.length > 8192 || root.length > 8192 || !isAbsolute(file) || !isAbsolute(root)) return false;
  const delta = relative(root, file);
  return Boolean(delta) && delta !== '..' && !delta.startsWith(`..${sep}`) && !isAbsolute(delta);
}
export function captureScanReceipt(row, root) {
  const receipt = row?.receipt; const file = receipt?.files?.[0]; const track = receipt?.scope?.tracks?.[0];
  if (!uuid(row?.import_candidate_id) || !uuid(row?.app_user_id) || !uuid(row?.receipt_revision_id)
    || receipt?.version !== 1 || receipt.ownerId !== row.app_user_id || !uuid(receipt.wantedReleaseId)
    || !uuid(receipt.sourceMediaRequestId) || receipt.scope?.version !== 1 || receipt.scope.mode !== 'tracks'
    || !uuid(receipt.scope.metadataReleaseId) || !isSupportedOperatorTrackScope(receipt.scope) || !uuid(file?.fileId)
    || receipt.scope.tracks?.length !== 1 || track?.mediumPosition !== 1 || receipt.files?.length !== 1
    || !isDeepStrictEqual(file.track, track) || !withinScanReceiptRoot(file.libraryPath, root)
    || !Number.isSafeInteger(file.evidence?.sizeBytes) || file.evidence.sizeBytes <= 0
    || !/^[a-f0-9]{64}$/u.test(file.evidence?.sha256 ?? '')) return null;
  return structuredClone({ candidateId: row.import_candidate_id, ownerId: row.app_user_id,
    revisionId: row.receipt_revision_id, receipt, libraryPath: file.libraryPath });
}
