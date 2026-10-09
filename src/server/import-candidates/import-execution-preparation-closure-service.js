/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { randomUUID } from 'node:crypto';
import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { createImportExecutionPreparationClosureStore } from './import-execution-preparation-closure-store.js';
import { evaluateAbandonedPreparation } from './import-execution-preparation-closure-policy.js';
import { validatePreProviderEpoch, preparationLeaseIdentity, hasCurrentPreparationLease } from './import-execution-pre-provider-policy.js';

const stale = () => createApiError(409, 'import_execution_preparation_closure_stale', 'The preparation changed before it could be closed');
const iso = (value) => value?.toISOString?.() ?? value ?? null;

/** System reconciliation closes a provably undispatched epoch; it never restores or sends downloads. */
export function createImportExecutionPreparationClosureService({ store = createImportExecutionPreparationClosureStore(),
  withTransaction = createDatabaseTransactionRunner(), recordAuditEventFn = recordAuditEvent } = {}) {
  for (const [name, fn] of Object.entries({ lockContext: store.lockContext, acquireClosureLease: store.acquireClosureLease,
    readClock: store.readClock, saveEpoch: store.saveEpoch, saveClosureFence: store.saveClosureFence,
    releaseClosureLease: store.releaseClosureLease, withTransaction, recordAuditEventFn })) {
    if (typeof fn !== 'function') throw new TypeError(`Preparation closure requires ${name}`);
  }
  async function closeAbandonedPreparation({ operationRunId, importCandidateId, expectedEpoch }) {
    if (!validatePreProviderEpoch(expectedEpoch, { runId: operationRunId, importCandidateId }) || expectedEpoch.phase !== 'preparing') {
      return { closed: false, reasonCode: 'preparation_not_eligible' };
    }
    return withTransaction(async (queryable) => {
      const context = await store.lockContext({ runId: operationRunId, importCandidateId, queryable });
      const decision = evaluateAbandonedPreparation({ context, operationRunId, importCandidateId, expectedEpoch });
      if (!decision.eligible) return { closed: false, reasonCode: decision.reasonCode };
      const lease = await store.acquireClosureLease({ runId: operationRunId, ownerInstanceId: `preparation-closure:${randomUUID()}`, queryable });
      const closedAt = await store.readClock(queryable);
      if (!hasCurrentPreparationLease(lease, lease, operationRunId, Date.parse(closedAt))) throw stale();
      const closure = { version: 1, operationRunId, importCandidateId, epochId: decision.epoch.epochId,
        generation: decision.epoch.generation, closedAt, reasonCode: decision.reasonCode,
        lease: preparationLeaseIdentity(lease, operationRunId), cancelRequestedAt: iso(context.run.cancelRequestedAt),
        cancelledAt: iso(context.run.cancelledAt) };
      const epoch = { ...decision.epoch, phase: 'refused', refusal: { reasonCode: decision.reasonCode, refusedAt: closedAt }, closure };
      if (!validatePreProviderEpoch(epoch, { runId: operationRunId, importCandidateId })) throw stale();
      if (!await store.saveEpoch({ context, epoch, itemStatus: 'blocked', outcome: 'pre_provider_refused',
        handoffState: epoch.attemptId ? 'not_dispatched' : 'pre_provider_refused',
        statusMessage: 'This request stopped before any download was sent.', queryable })
        || !await store.saveClosureFence({ context, closure, queryable })) throw stale();
      await recordAuditEventFn({ actorType: 'system', actorUserId: null, eventType: 'import_execution_preparation_closed',
        entityType: 'operation_run', entityId: operationRunId, summary: 'Abandoned download preparation stopped before dispatch',
        details: { importCandidateId, epochId: epoch.epochId, generation: epoch.generation, reasonCode: decision.reasonCode } }, queryable);
      if (!await store.releaseClosureLease({ runId: operationRunId, lease, queryable })) throw stale();
      return { closed: true };
    });
  }
  return { closeAbandonedPreparation };
}
