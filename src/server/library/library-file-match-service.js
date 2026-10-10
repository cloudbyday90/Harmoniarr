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
import { createLibraryFileMatchGuardStore } from './library-file-match-guard-store.js';
import { captureFileMatchBatch, captureFileMatchResults, isCurrentFileMatchScope, isCurrentFileMatchSource } from './library-file-match-policy.js';

export function createLibraryFileMatchService({
  writeLibraryFileMatchBatch,
  assertMaintenanceWriteAllowed,
  store = createLibraryFileMatchGuardStore(),
  withTransaction = createDatabaseTransactionRunner(),
} = {}) {
  for (const [name, fn] of Object.entries({ writeLibraryFileMatchBatch, assertMaintenanceWriteAllowed, withTransaction,
    lockContext: store.lockContext, readContext: store.readContext, readClock: store.readClock })) {
    if (typeof fn !== 'function') throw new TypeError(`File matching requires ${name}`);
  }

  async function assertCurrent({ context, prepared, queryable }) {
    const now = await store.readClock(queryable);
    const { run, lease, files } = context;
    if (!run || run.id !== prepared.runId || run.operation_type !== 'library_scan'
      || !isCurrentJobLeaseAcquisition(lease, prepared.expectedLease, { leaseKey: prepared.expectedLease.leaseKey, now })) {
      throw createApiError(409, 'operation_run_lease_lost', 'This file matching no longer owns the scan');
    }
    if (run.cancel_requested_at != null || run.cancelled_at != null) {
      throw createOperationRunCancellationError({ runId: prepared.runId });
    }
    if (run.status !== 'running') {
      throw createApiError(409, 'operation_run_lease_lost', 'This file matching scan is no longer running');
    }
    const currentFiles = new Map((files ?? []).map((file) => [file.id, file]));
    if (run.summary?.libraryRoot !== prepared.requestedLibraryRoot || !isCurrentFileMatchScope(run, prepared)
      || currentFiles.size !== prepared.files.length
      || !prepared.files.every((file) => isCurrentFileMatchSource(currentFiles.get(file.id), prepared, file))) {
      throw createApiError(409, 'library_file_match_stale', 'The library file or matching source changed before persistence');
    }
  }

  async function writeOwnedLibraryFileMatchBatch({ prepared: input, matches: inputMatches }) {
    const prepared = captureFileMatchBatch(input);
    const matches = prepared ? captureFileMatchResults(inputMatches, prepared) : null;
    if (!prepared || !matches) {
      throw createApiError(409, 'library_file_match_invalid', 'The file matching source or results are invalid');
    }
    if (matches.length === 0) return { libraryFileIds: [] };
    return withTransaction(async (queryable) => {
      try {
        await assertMaintenanceWriteAllowed({ queryable });
      } catch (error) {
        if (error?.code !== 'recovery_lock_conflict') throw error;
        throw createOperationRunPauseError({ runId: prepared.runId, pauseCode: 'maintenance_lock_active',
          message: 'File matching is paused by a maintenance lock' });
      }
      await assertCurrent({ context: await store.lockContext({ prepared, queryable }), prepared, queryable });
      const recheck = async () => assertCurrent({
        context: await store.readContext({ prepared, queryable }), prepared, queryable,
      });
      const result = await writeLibraryFileMatchBatch({ matches, expectedSources: prepared.files,
        queryable, beforeWrite: recheck });
      await recheck();
      const expected = new Set(prepared.files.map((file) => file.id));
      if (!Array.isArray(result?.libraryFileIds) || result.libraryFileIds.length !== expected.size
        || !result.libraryFileIds.every((id) => expected.delete(id))) {
        throw createApiError(409, 'library_file_match_incomplete', 'The file matching update could not be verified');
      }
      return { libraryFileIds: [...result.libraryFileIds] };
    });
  }

  return { writeOwnedLibraryFileMatchBatch };
}
