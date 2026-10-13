/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { captureClosedWantedReceiptGroup } from './wanted-receipt-group-policy.js';
import { wantedRootReadTransaction } from './wanted-root-read-authority-service.js';

const unavailable = error => ['ENOENT', 'ENOTDIR', 'operator_track_scope_verification_required'].includes(error?.code);

export function createWantedClosedReceiptGroupService({ readRoot, fingerprint }) {
  async function tryVerifyGroup({ receipts, ownerId, queryable, observer, enabled, rootReadAuthority, allowBoundedRoots = false }) {
    const rows = enabled ? captureClosedWantedReceiptGroup(receipts, ownerId) : null;
    if (!rows) return null;
    const transactionId = allowBoundedRoots ? wantedRootReadTransaction(rootReadAuthority, queryable) : null;
    const rootReads = transactionId ? 1 : rows.length;
    const fallback = () => { observer.increment('receiptGroupingFallbacks'); return null; };
    const stale = () => {
      observer.increment('receiptGroupRefusals');
      return createApiError(409, 'library_wanted_projection_stale', 'Current receipt evidence changed while closing its group');
    };
    let root; let opening;
    try {
      for (let index = 0; index < rootReads; index++) {
        const current = await readRoot({ ownerId, queryable, observer, expectedTransactionId: transactionId });
        if (typeof current !== 'string' || !current || (root && root !== current)) return fallback();
        root = current;
      }
      opening = await fingerprint(rows[0], root, observer);
    } catch (error) {
      if (unavailable(error)) return fallback();
      if (error?.code === 'library_wanted_projection_stale') { observer.increment('receiptGroupRefusals'); throw error; }
      observer.increment('unexpectedErrors'); throw error;
    }
    if (!isDeepStrictEqual(opening, rows[0].files[0].evidence)) return fallback();
    try {
      if (transactionId && wantedRootReadTransaction(rootReadAuthority, queryable) !== transactionId) throw stale();
      for (let index = 0; index < rootReads; index++) {
        if (await readRoot({ ownerId, queryable, observer, expectedTransactionId: transactionId }) !== root) throw stale();
      }
      const closing = await fingerprint(rows[0], root, observer);
      if (transactionId && wantedRootReadTransaction(rootReadAuthority, queryable) !== transactionId) throw stale();
      if (!isDeepStrictEqual(opening, closing) || !isDeepStrictEqual(receipts, rows)) throw stale();
    } catch (error) {
      if (unavailable(error)) throw stale();
      if (error?.code !== 'library_wanted_projection_stale') observer.increment('unexpectedErrors');
      throw error;
    }
    observer.increment('eligibleReceipts', rows.length); observer.increment('availableReceipts', rows.length);
    observer.increment('groupedReceiptRows', rows.length); observer.increment('closedReceiptGroups');
    if (transactionId) { observer.increment('boundedRootGroups'); observer.increment('boundedRootReceiptRows', rows.length); }
    return rows.map(() => ({ eligible: true, available: true, currentRoot: root, missing: false }));
  }
  return { tryVerifyGroup };
}
