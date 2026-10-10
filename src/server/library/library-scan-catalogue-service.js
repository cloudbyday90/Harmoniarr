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
import { captureScanCatalogue, isCompleteScanCatalogueResult } from './library-scan-catalogue-policy.js';
import { createLibraryScanCatalogueStore } from './library-scan-catalogue-store.js';

export function createLibraryScanCatalogueService({
  recordLibraryFiles,
  assertMaintenanceWriteAllowed,
  store = createLibraryScanCatalogueStore(),
  withTransaction = createDatabaseTransactionRunner(),
} = {}) {
  for (const [name, fn] of Object.entries({ recordLibraryFiles, assertMaintenanceWriteAllowed, withTransaction,
    lockContext: store.lockContext, readContext: store.readContext, readClock: store.readClock })) {
    if (typeof fn !== 'function') throw new TypeError(`Scan catalogue requires ${name}`);
  }

  async function assertCurrent({ context, prepared, queryable }) {
    const now = await store.readClock(queryable);
    const { run, lease } = context;
    if (!run || run.id !== prepared.runId || run.operation_type !== 'library_scan'
      || !isCurrentJobLeaseAcquisition(lease, prepared.expectedLease, { leaseKey: prepared.expectedLease.leaseKey, now })) {
      throw createApiError(409, 'operation_run_lease_lost', 'This scan worker no longer owns the operation');
    }
    if (run.cancel_requested_at != null || run.cancelled_at != null) {
      throw createOperationRunCancellationError({ runId: prepared.runId });
    }
    if (run.status !== 'running') {
      throw createApiError(409, 'operation_run_lease_lost', 'This scan operation is no longer running');
    }
    if (run.summary?.libraryRoot !== prepared.requestedLibraryRoot) {
      throw createApiError(409, 'library_scan_catalogue_stale', 'The requested library root changed during this scan');
    }
  }

  async function recordLibraryScanCatalogue(input) {
    const prepared = captureScanCatalogue(input);
    if (!prepared) throw createApiError(409, 'library_scan_catalogue_invalid', 'The scan observations are invalid');
    return withTransaction(async (queryable) => {
      try {
        await assertMaintenanceWriteAllowed({ queryable });
      } catch (error) {
        if (error?.code !== 'recovery_lock_conflict') throw error;
        throw createOperationRunPauseError({ runId: prepared.runId, pauseCode: 'maintenance_lock_active',
          message: 'Library scan is paused by a maintenance lock' });
      }
      const context = await store.lockContext({ prepared, queryable });
      await assertCurrent({ context, prepared, queryable });
      const recheck = async () => assertCurrent({
        context: await store.readContext({ prepared, queryable }), prepared, queryable,
      });
      const result = await recordLibraryFiles({
        files: prepared.files,
        libraryRootPath: prepared.libraryRootPath,
        queryable,
        beforeWrite: recheck,
      });
      await recheck();
      if (!isCompleteScanCatalogueResult(result, prepared)
        || (context.root && result.libraryRootId !== context.root.id)) {
        throw createApiError(409, 'library_scan_catalogue_incomplete', 'The scan catalogue update could not be verified');
      }
      return result;
    });
  }

  return { recordLibraryScanCatalogue };
}
