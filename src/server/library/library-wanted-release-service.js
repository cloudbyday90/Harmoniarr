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
import { MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE } from '../import-candidates/music-queue-recovery-policy.js';
import { createLibraryWantedReleaseStore } from './library-wanted-release-store.js';
import { createLibraryWantedReleaseReader } from './library-wanted-release-reader.js';
import { createLibraryWantedReleaseGuardStore } from './library-wanted-release-guard-store.js';
import { captureWantedContext, captureWantedRows, captureWantedSource, sameWantedProjection,
  isCompleteWantedReplacement } from './library-wanted-release-reconciliation-policy.js';

export function createLibraryWantedReleaseService({
  getPoolFn = getPool,
  libraryWantedReleaseStore = createLibraryWantedReleaseStore({ getPoolFn }),
  projectionReader = createLibraryWantedReleaseReader(),
  store = createLibraryWantedReleaseGuardStore(),
  assertMaintenanceWriteAllowed,
  withTransaction = createDatabaseTransactionRunner({ getPoolFn }),
} = {}) {
  for (const [name, fn] of Object.entries({ assertMaintenanceWriteAllowed, withTransaction,
    replaceLibraryWantedReleases: libraryWantedReleaseStore.replaceLibraryWantedReleases,
    readWantedReleaseProjection: projectionReader.readWantedReleaseProjection,
    lockContext: store.lockContext, readContext: store.readContext, readClock: store.readClock })) {
    if (typeof fn !== 'function') throw new TypeError('Wanted reconciliation requires ' + name);
  }

  async function assertCurrent({ prepared, context, queryable }) {
    if (prepared.mode === 'direct') return;
    const now = await store.readClock(queryable); const { run, lease } = context;
    if (!run || run.id !== prepared.runId || run.operation_type !== prepared.operationType
      || !isCurrentJobLeaseAcquisition(lease, prepared.expectedLease, { leaseKey: prepared.expectedLease.leaseKey, now })) {
      throw createApiError(409, 'operation_run_lease_lost', 'Wanted reconciliation no longer owns its operation');
    }
    if (run.cancel_requested_at != null || run.cancelled_at != null) {
      throw createOperationRunCancellationError({ runId: prepared.runId });
    }
    if (run.status !== 'running') throw createApiError(409, 'operation_run_lease_lost', 'This operation is no longer running');
    if (run.summary?.triggerSource === MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE) {
      throw createApiError(409, 'library_wanted_projection_invalid', 'Scoped recovery cannot replace global wanted releases');
    }
  }

  async function readProjection(queryable) {
    const input = await projectionReader.readWantedReleaseProjection({ queryable });
    const wantedReleases = captureWantedRows(input?.wantedReleases); const source = captureWantedSource(input?.source);
    if (!wantedReleases || !source) throw createApiError(409, 'library_wanted_projection_invalid', 'Wanted projection could not be verified');
    return Object.freeze({ wantedReleases, source });
  }

  async function reconcileWantedReleases(input = {}) {
    const prepared = captureWantedContext(input);
    if (!prepared) throw createApiError(409, 'library_wanted_projection_invalid', 'The original wanted operation context is invalid');
    return withTransaction(async (queryable) => {
      await queryable.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      try {
        await assertMaintenanceWriteAllowed({ queryable });
      } catch (error) {
        if (error?.code !== 'recovery_lock_conflict') throw error;
        if (prepared.mode === 'direct') throw error;
        throw createOperationRunPauseError({ runId: prepared.runId, pauseCode: 'maintenance_lock_active',
          message: 'Wanted reconciliation is paused by maintenance' });
      }
      await assertCurrent({ prepared, context: await store.lockContext({ prepared, queryable }), queryable });
      const projection = await readProjection(queryable);
      const recheck = async () => {
        const current = await readProjection(queryable);
        await assertCurrent({ prepared, context: await store.readContext({ prepared, queryable }), queryable });
        if (!sameWantedProjection(current, projection)) {
          throw createApiError(409, 'library_wanted_projection_stale', 'Saved policy or availability changed during wanted reconciliation');
        }
      };
      const result = await libraryWantedReleaseStore.replaceLibraryWantedReleases({
        wantedReleases: projection.wantedReleases, queryable, beforeWrite: recheck,
      });
      await recheck();
      if (!isCompleteWantedReplacement(result, projection.wantedReleases)) {
        throw createApiError(409, 'library_wanted_projection_incomplete', 'The wanted replacement could not be verified');
      }
      return { wantedKeys: result.wantedKeys.map((key) => ({ appUserId: key.appUserId, metadataReleaseId: key.metadataReleaseId })),
        deletedWantedKeys: result.deletedWantedKeys.map((key) => ({ appUserId: key.appUserId, metadataReleaseId: key.metadataReleaseId })) };
    });
  }

  return { reconcileWantedReleases };
}
