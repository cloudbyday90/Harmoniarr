/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createApiError } from '../auth.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { isCurrentJobLeaseAcquisition } from '../job-lease-policy.js';
import {
  createOperationRunCancellationError,
  createOperationRunPauseError,
} from '../operation-run-cancellation.js';
import {
  captureOrganizeMutation,
  isCurrentOrganizeFile,
  isVerifiedOrganizeMove,
} from './library-organize-mutation-policy.js';
import { createLibraryOrganizeMutationStore } from './library-organize-mutation-store.js';

const lost = () => createApiError(409, 'operation_run_lease_lost', 'This organize worker no longer owns the operation');
const stale = () => createApiError(409, 'library_organize_plan_stale', 'The library file changed before this organize operation');

export function createLibraryOrganizeMutationService({
  store = createLibraryOrganizeMutationStore(),
  withTransaction = createDatabaseTransactionRunner(),
  applyExclusiveFileMutationPlan,
  assertMaintenanceWriteAllowed,
} = {}) {
  const dependencies = {
    lockContext: store.lockContext,
    readClock: store.readClock,
    updateCanonicalPath: store.updateCanonicalPath,
    withTransaction,
    applyExclusiveFileMutationPlan,
    assertMaintenanceWriteAllowed,
  };
  for (const [name, fn] of Object.entries(dependencies)) {
    if (typeof fn !== 'function') {
      throw new TypeError(`Organize mutation requires ${name}`);
    }
  }

  async function withCurrentMutation(prepared, write = false) {
    return withTransaction(async (queryable) => {
      try {
        await assertMaintenanceWriteAllowed({ queryable });
      } catch (error) {
        if (error?.code !== 'recovery_lock_conflict') {
          throw error;
        }
        throw createOperationRunPauseError({
          runId: prepared.runId,
          pauseCode: 'maintenance_lock_active',
          message: 'Library organize is paused by a maintenance lock',
        });
      }
      const context = await store.lockContext({ prepared, queryable });
      const now = await store.readClock(queryable);
      if (!context.run
        || context.run.id !== prepared.runId
        || context.run.operation_type !== 'library_organize_apply'
        || !isCurrentJobLeaseAcquisition(context.lease, prepared.expectedLease, {
          leaseKey: prepared.expectedLease.leaseKey,
          now,
        })) {
        throw lost();
      }
      if (context.run.cancel_requested_at != null || context.run.cancelled_at != null) {
        throw createOperationRunCancellationError({ runId: prepared.runId });
      }
      if (context.run.status !== 'running') {
        throw lost();
      }
      if (!isCurrentOrganizeFile(context.file, prepared)) {
        throw stale();
      }
      if (write && !await store.updateCanonicalPath({ context, prepared, queryable })) {
        throw stale();
      }
      return true;
    });
  }

  async function applyOrganizeMutation(input) {
    const prepared = captureOrganizeMutation(input);
    if (!prepared) {
      throw stale();
    }
    const result = await applyExclusiveFileMutationPlan(prepared.plan, {
      beforeMutation: () => withCurrentMutation(prepared),
    });
    if (!isVerifiedOrganizeMove(result)) {
      throw createApiError(409, 'library_organize_move_unverified', 'The organize move could not be verified');
    }
    await withCurrentMutation(prepared, true);
    return result;
  }

  return { applyOrganizeMutation };
}
