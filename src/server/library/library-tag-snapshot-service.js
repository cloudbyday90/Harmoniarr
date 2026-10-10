/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createApiError } from '../auth.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { isCurrentJobLeaseAcquisition } from '../job-lease-policy.js';
import { createOperationRunCancellationError, createOperationRunPauseError } from '../operation-run-cancellation.js';
import { captureTagSnapshotPayload, captureTagSnapshotSource, isCurrentTagSnapshotSource } from './library-tag-snapshot-policy.js';
import { createLibraryTagSnapshotGuardStore } from './library-tag-snapshot-guard-store.js';

export function createLibraryTagSnapshotService({
  writeLibraryFileTagSnapshot,
  assertMaintenanceWriteAllowed,
  store = createLibraryTagSnapshotGuardStore(),
  withTransaction = createDatabaseTransactionRunner(),
} = {}) {
  for (const [name, fn] of Object.entries({ writeLibraryFileTagSnapshot, assertMaintenanceWriteAllowed, withTransaction,
    lockContext: store.lockContext, readContext: store.readContext, readClock: store.readClock })) {
    if (typeof fn !== 'function') throw new TypeError(`Tag snapshot requires ${name}`);
  }

  async function assertCurrent({ context, prepared, queryable }) {
    const now = await store.readClock(queryable);
    const { run, lease, file } = context;
    if (!run || run.id !== prepared.runId || run.operation_type !== 'library_scan'
      || !isCurrentJobLeaseAcquisition(lease, prepared.expectedLease, { leaseKey: prepared.expectedLease.leaseKey, now })) {
      throw createApiError(409, 'operation_run_lease_lost', 'This tag extraction no longer owns the scan');
    }
    if (run.cancel_requested_at != null || run.cancelled_at != null) {
      throw createOperationRunCancellationError({ runId: prepared.runId });
    }
    if (run.status !== 'running') {
      throw createApiError(409, 'operation_run_lease_lost', 'This tag extraction scan is no longer running');
    }
    if (run.summary?.libraryRoot !== prepared.requestedLibraryRoot || !isCurrentTagSnapshotSource(file, prepared)) {
      throw createApiError(409, 'library_tag_snapshot_stale', 'The library file changed before tag persistence');
    }
  }

  async function writeOwnedLibraryFileTagSnapshot({ prepared: input, payload: inputPayload }) {
    const prepared = captureTagSnapshotSource(input);
    const payload = captureTagSnapshotPayload(inputPayload);
    if (!prepared || !payload) {
      throw createApiError(409, 'library_tag_snapshot_invalid', 'The tag extraction source or payload is invalid');
    }
    return withTransaction(async (queryable) => {
      try {
        await assertMaintenanceWriteAllowed({ queryable });
      } catch (error) {
        if (error?.code !== 'recovery_lock_conflict') throw error;
        throw createOperationRunPauseError({ runId: prepared.runId, pauseCode: 'maintenance_lock_active',
          message: 'Tag extraction is paused by a maintenance lock' });
      }
      await assertCurrent({ context: await store.lockContext({ prepared, queryable }), prepared, queryable });
      const recheck = async () => assertCurrent({
        context: await store.readContext({ prepared, queryable }), prepared, queryable,
      });
      const result = await writeLibraryFileTagSnapshot({
        ...payload,
        libraryFileId: prepared.file.id,
        sourceSizeBytes: prepared.file.sizeBytes,
        sourceModifiedAt: prepared.file.modifiedAt,
        expectedSource: prepared.file,
        queryable,
        beforeWrite: recheck,
      });
      await recheck();
      if (!result || result.libraryFileId !== prepared.file.id || typeof result.snapshotId !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(result.snapshotId)) {
        throw createApiError(409, 'library_tag_snapshot_incomplete', 'The tag snapshot update could not be verified');
      }
      return result;
    });
  }

  return { writeOwnedLibraryFileTagSnapshot };
}
