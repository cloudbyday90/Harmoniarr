/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isDeepStrictEqual } from 'node:util';
import { fingerprintOperatorTrackFile } from '../metadata/operator-track-file-evidence-service.js';
import { createOperatorTrackDeliveryPlanService } from '../metadata/operator-track-delivery-plan-service.js';
import { disabledWantedVerificationObserver } from './library-wanted-verification-observer.js';
import { createWantedClosedReceiptGroupService } from './wanted-closed-receipt-group-service.js';

export function createWantedReceiptVerificationService({ fingerprintTrackFile = fingerprintOperatorTrackFile,
  resolvePrivateTrackRoot,
  allowBoundedRootReads = fingerprintTrackFile === fingerprintOperatorTrackFile,
  allowGroupedReceipts = fingerprintTrackFile === fingerprintOperatorTrackFile && resolvePrivateTrackRoot === undefined } = {}) {
  if (typeof allowGroupedReceipts !== 'boolean') throw new TypeError('Invalid receipt grouping setting');
  if (typeof allowBoundedRootReads !== 'boolean') throw new TypeError('Invalid bounded root setting');
  const rootResolver = resolvePrivateTrackRoot === undefined
    ? createOperatorTrackDeliveryPlanService().resolvePrivateOwnerRoot : resolvePrivateTrackRoot;
  const readRoot = ({ ownerId, queryable, observer, expectedTransactionId = null }) => observer.measure('root_resolution',
    () => rootResolver({ ownerId, queryable, ...(expectedTransactionId ? { expectedTransactionId } : {}) }));
  async function fingerprint(receipt, currentRoot, observer) {
    const options = { ...(currentRoot ? { libraryRoot: currentRoot } : {}),
      ...(observer.enabled ? { onBytesRead: amount => observer.increment('hashedBytes', amount) } : {}) };
    observer.increment('fingerprintCalls');
    try {
      const evidence = await observer.measure('fingerprint', () => fingerprintTrackFile(receipt.files[0].libraryPath, options));
      observer.increment('fingerprintCompleted'); return evidence;
    } catch (error) { observer.increment('fingerprintFailures'); throw error; }
  }
  async function verify({ receipt, ownerId, queryable, observer = disabledWantedVerificationObserver }) {
    if (receipt?.version !== 1 || receipt.ownerId !== ownerId || receipt.files?.length !== 1) {
      observer.increment('ineligibleReceipts'); return { eligible: false };
    }
    observer.increment('eligibleReceipts'); let currentRoot = null;
    try {
      if (receipt.wantedReleaseId) currentRoot = await readRoot({ ownerId, queryable, observer });
      const evidence = await fingerprint(receipt, currentRoot, observer);
      const available = isDeepStrictEqual(evidence, receipt.files[0].evidence);
      observer.increment(available ? 'availableReceipts' : 'mismatchedReceipts');
      return { eligible: true, available, currentRoot, missing: false };
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'operator_track_scope_verification_required'].includes(error?.code)) {
        observer.increment(error.code === 'operator_track_scope_verification_required' ? 'refusedReceipts' : 'missingReceipts');
        return { eligible: true, available: false, currentRoot, missing: error.code === 'ENOENT' };
      }
      observer.increment('unexpectedErrors'); throw error;
    }
  }
  const groups = createWantedClosedReceiptGroupService({ readRoot, fingerprint });
  return { verify, tryVerifyGroup: ({ observer = disabledWantedVerificationObserver, ...input } = {}) =>
    groups.tryVerifyGroup({ ...input, observer, enabled: allowGroupedReceipts,
      allowBoundedRoots: allowBoundedRootReads && resolvePrivateTrackRoot === undefined }) };
}
