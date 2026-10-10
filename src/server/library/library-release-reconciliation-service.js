/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { getPool } from '../database.js';
import { createApiError } from '../auth.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { isCurrentJobLeaseAcquisition } from '../job-lease-policy.js';
import { createOperationRunCancellationError, createOperationRunPauseError } from '../operation-run-cancellation.js';
import { createLibraryReleaseReconciliationStore } from './library-release-reconciliation-store.js';
import { createLibraryReleaseCoverageStore } from './library-release-coverage-store.js';
import { createLibraryReleaseReconciliationGuardStore } from './library-release-reconciliation-guard-store.js';
import { captureReleaseReconciliationContext, mapReleaseCoverageRows, sameReleaseCoverage,
  isCompleteReleaseReconciliationResult } from './library-release-reconciliation-policy.js';

export function createLibraryReleaseReconciliationService({
  getPoolFn = getPool,
  libraryReleaseReconciliationStore = createLibraryReleaseReconciliationStore({ getPoolFn }),
  coverageStore = createLibraryReleaseCoverageStore(),
  store = createLibraryReleaseReconciliationGuardStore(),
  assertMaintenanceWriteAllowed,
  withTransaction = createDatabaseTransactionRunner({ getPoolFn }),
} = {}) {
  for (const [name, fn] of Object.entries({ assertMaintenanceWriteAllowed, withTransaction,
    replaceLibraryReleaseReconciliations: libraryReleaseReconciliationStore.replaceLibraryReleaseReconciliations,
    loadLibraryReleaseCoverageRows: coverageStore.loadLibraryReleaseCoverageRows,
    lockContext: store.lockContext, readContext: store.readContext, readClock: store.readClock })) {
    if (typeof fn !== 'function') throw new TypeError('Release reconciliation requires ' + name);
  }

  async function assertCurrent({ context, prepared, queryable }) {
    const now = await store.readClock(queryable);
    const { run, lease, root } = context;
    if (!run || run.id !== prepared.runId || run.operation_type !== 'library_scan'
      || !isCurrentJobLeaseAcquisition(lease, prepared.expectedLease, { leaseKey: prepared.expectedLease.leaseKey, now })) {
      throw createApiError(409, 'operation_run_lease_lost', 'This release reconciliation no longer owns the scan');
    }
    if (run.cancel_requested_at != null || run.cancelled_at != null) {
      throw createOperationRunCancellationError({ runId: prepared.runId });
    }
    if (run.status !== 'running') throw createApiError(409, 'operation_run_lease_lost', 'This scan is no longer running');
    if (run.summary?.libraryRoot !== prepared.requestedLibraryRoot || root?.id !== prepared.libraryRootId
      || root.canonicalPath !== prepared.libraryRootPath) {
      throw createApiError(409, 'library_release_reconciliation_stale', 'The scan root changed before release reconciliation');
    }
  }

  async function readCoverage(queryable) {
    const coverage = mapReleaseCoverageRows(await coverageStore.loadLibraryReleaseCoverageRows({ queryable }));
    if (!coverage) throw createApiError(409, 'library_release_reconciliation_invalid', 'Release coverage could not be verified');
    return coverage;
  }

  async function reconcileLibraryReleases(input) {
    const prepared = captureReleaseReconciliationContext(input);
    if (!prepared) throw createApiError(409, 'library_release_reconciliation_invalid', 'The original scan context is invalid');
    return withTransaction(async (queryable) => {
      await queryable.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      try {
        await assertMaintenanceWriteAllowed({ queryable });
      } catch (error) {
        if (error?.code !== 'recovery_lock_conflict') throw error;
        throw createOperationRunPauseError({ runId: prepared.runId, pauseCode: 'maintenance_lock_active',
          message: 'Release reconciliation is paused by a maintenance lock' });
      }
      await assertCurrent({ context: await store.lockContext({ prepared, queryable }), prepared, queryable });
      const reconciliations = await readCoverage(queryable);
      const recheck = async () => {
        const current = await readCoverage(queryable);
        await assertCurrent({ context: await store.readContext({ prepared, queryable }), prepared, queryable });
        if (!sameReleaseCoverage(current, reconciliations)) {
          throw createApiError(409, 'library_release_reconciliation_stale', 'Library coverage changed during release reconciliation');
        }
      };
      const result = await libraryReleaseReconciliationStore.replaceLibraryReleaseReconciliations({
        reconciliations, queryable, beforeWrite: recheck,
      });
      await recheck();
      if (!isCompleteReleaseReconciliationResult(result, reconciliations)) {
        throw createApiError(409, 'library_release_reconciliation_incomplete', 'The release reconciliation replacement could not be verified');
      }
      return { metadataReleaseIds: [...result.metadataReleaseIds], deletedMetadataReleaseIds: [...result.deletedMetadataReleaseIds] };
    });
  }

  return { reconcileLibraryReleases };
}
