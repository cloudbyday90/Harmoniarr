/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isDeepStrictEqual } from 'node:util';
import { getPool } from '../database.js';
import { createOperatorTrackDeliveryPlanService } from '../metadata/operator-track-delivery-plan-service.js';
import { createLibraryScanReceiptStore } from './library-scan-receipt-store.js';
import { captureScanReceipt, sameScanReceiptPath, scanReceiptPathKey, withinScanReceiptRoot } from './library-scan-receipt-policy.js';
import { createLibraryScanReceiptFileService, staleScanReceipt } from './library-scan-receipt-file-service.js';

export function createLibraryScanReceiptService({ getPoolFn = getPool, store = createLibraryScanReceiptStore(),
  resolvePrivateRoot = createOperatorTrackDeliveryPlanService({ getPoolFn }).resolvePrivateOwnerRoot,
  fileService = createLibraryScanReceiptFileService() } = {}) {
  const snapshots = new WeakMap();
  async function capture({ prepared, queryable }) {
    const targets = []; const roots = new Map();
    for (const row of await store.listForRoot({ root: prepared.libraryRootPath, queryable })) {
      const target = captureScanReceipt(row, prepared.libraryRootPath);
      if (!target) continue;
      if (!roots.has(target.ownerId)) {
        try { roots.set(target.ownerId, await resolvePrivateRoot({ ownerId: target.ownerId, queryable })); }
        catch (error) { if (error?.code !== 'operator_track_scope_verification_required') throw error; roots.set(target.ownerId, null); }
      }
      target.privateRoot = roots.get(target.ownerId);
      if (!withinScanReceiptRoot(target.libraryPath, target.privateRoot)) continue;
      targets.push(target);
    }
    if (!targets.length) return null;
    const token = Object.freeze({});
    snapshots.set(token, structuredClone({ prepared, targets }));
    return token;
  }
  async function recordMissing({ token, prepared, libraryRootId, queryable, assertCurrent }) {
    const snapshot = snapshots.get(token);
    if (!snapshot || snapshot.prepared.runId !== prepared.runId
      || !isDeepStrictEqual(snapshot.prepared.expectedLease, prepared.expectedLease)
      || snapshot.prepared.requestedLibraryRoot !== prepared.requestedLibraryRoot
      || !sameScanReceiptPath(snapshot.prepared.libraryRootPath, prepared.libraryRootPath)) throw staleScanReceipt();
    const published = []; let count = 0;
    const observed = new Set(prepared.files.map(file => scanReceiptPathKey(file.canonicalPath)));
    const isMissing = async target => fileService.isMissing({ target, scanRoot: prepared.libraryRootPath,
      privateRoot: await resolvePrivateRoot({ ownerId: target.ownerId, queryable }) });
    for (const target of snapshot.targets) {
      if (observed.has(scanReceiptPathKey(target.libraryPath))) continue;
      await assertCurrent();
      const current = await store.lockReceipt({ target, queryable });
      if (!current || current.receipt_revision_id !== target.revisionId || !isDeepStrictEqual(current.receipt, target.receipt)) continue;
      if (!await isMissing(target)) continue;
      if (await store.recordMissing({ target, prepared, libraryRootId, queryable })) {
        await store.insertEvent({ target, prepared, queryable }); count++;
      }
      published.push(target);
      await assertCurrent();
    }
    for (const target of published) if (!await isMissing(target)) throw staleScanReceipt();
    await assertCurrent(); snapshots.delete(token);
    return count;
  }
  return { capture, recordMissing };
}
