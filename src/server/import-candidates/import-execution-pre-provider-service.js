/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { createImportExecutionPreProviderStore } from './import-execution-pre-provider-store.js';
import { hasPreProviderProtocol, normalizePreparationFiles, preparationLeaseIdentity, hasCurrentPreparationLease,
  validatePreProviderEpoch, hasPreparationProviderEvidence, PRE_PROVIDER_REFUSAL_REASONS } from './import-execution-pre-provider-policy.js';
import { matchesRecoveryObservation } from './music-queue-recovery-policy.js';
import { validateDownloadAttempt } from '../slskd/slskd-download-attempt-policy.js';

const stale = () => createApiError(409, 'import_execution_preparation_stale', 'The preparation owner changed before dispatch');
const executionFor = (context) => context.item?.planningSnapshot?.execution ?? {};

export function createImportExecutionPreProviderService({ store = createImportExecutionPreProviderStore(),
  withTransaction = createDatabaseTransactionRunner(), recordAuditEventFn = recordAuditEvent, getNow = () => new Date() } = {}) {
  for (const [name, fn] of Object.entries({ lockContext: store.lockContext, saveEpoch: store.saveEpoch,
    isCurrentOrigin: store.isCurrentOrigin, findUnresolvedOtherHandoff: store.findUnresolvedOtherHandoff,
    withTransaction, recordAuditEventFn, getNow })) {
    if (typeof fn !== 'function') throw new TypeError(`Preparation owner requires ${name}`);
  }
  async function audit(context, epoch, eventType, queryable) {
    await recordAuditEventFn({ actorType: 'system', actorUserId: null, eventType, entityType: 'operation_run',
      entityId: context.run.id, summary: eventType === 'import_execution_preparation_refused'
        ? 'Download preparation stopped before dispatch' : 'Download preparation ownership recorded',
      details: { importCandidateId: epoch.importCandidateId, epochId: epoch.epochId, generation: epoch.generation,
        ...(epoch.refusal ? { reasonCode: epoch.refusal.reasonCode } : {}) } }, queryable);
  }
  function owns(context, input, { active = false } = {}) {
    return context.run?.id === input.runId && context.run.operationType === 'import_candidate_execution_planning' && hasPreProviderProtocol(context.run)
      && !Object.hasOwn(context.run.summary, 'downloadOriginSupersession')
      && context.item?.operationRunId === input.runId && context.item.importCandidateId === input.importCandidateId
      && context.transferLinkCount === 0 && hasCurrentPreparationLease(context.lease, input.lease, input.runId, getNow().getTime())
      && (!active || (context.run.status === 'running' && context.run.cancelRequestedAt == null && context.run.cancelledAt == null));
  }
  function currentEpoch(context, input) {
    const epoch = validatePreProviderEpoch(executionFor(context).handoff?.preProviderEpoch,
      { runId: input.runId, importCandidateId: input.importCandidateId });
    return epoch && epoch.epochId === input.epochId && isDeepStrictEqual(epoch.lease, preparationLeaseIdentity(input.lease, input.runId)) ? epoch : null;
  }
  async function beginPreparation(input) {
    return withTransaction(async (queryable) => {
      const context = await store.lockContext({ ...input, queryable });
      if (!context.run || !context.item) return { tracked: true, allowPreparation: false, reasonCode: 'preparation_not_current' };
      const markerPresent = Object.hasOwn(context.run?.summary ?? {}, 'downloadPreparationProtocol');
      if (!markerPresent) return { tracked: false, allowPreparation: true };
      const blocked = { tracked: true, allowPreparation: false, reasonCode: 'preparation_not_current' };
      const execution = executionFor(context);
      const files = normalizePreparationFiles(input.requestedFiles);
      if (!owns(context, input, { active: true }) || !files || context.candidate?.status !== 'selected'
        || !matchesRecoveryObservation(context.candidate, input.sourceObservation)
        || hasPreparationProviderEvidence(execution)
        || (execution.handoff?.state != null && !['preparing', 'pre_provider_refused'].includes(execution.handoff.state))
        || !['ready', 'ready_with_warnings', 'blocked'].includes(context.item.itemStatus)) return blocked;
      const raw = execution.handoff?.preProviderEpoch;
      const existing = validatePreProviderEpoch(raw, { runId: input.runId, importCandidateId: input.importCandidateId });
      const identity = preparationLeaseIdentity(input.lease, input.runId);
      if (Object.hasOwn(execution.handoff ?? {}, 'preProviderEpoch')) {
        if (!existing) return blocked;
        if (isDeepStrictEqual(existing.lease, identity)) {
          return existing.phase === 'preparing' && isDeepStrictEqual(existing.sourceObservation, input.sourceObservation)
            && isDeepStrictEqual(existing.requestedFiles, files)
            ? { tracked: true, allowPreparation: true, epochId: existing.epochId, epoch: existing }
            : { ...blocked, epochId: existing.epochId };
        }
        if (existing.phase !== 'refused' || existing.attemptId != null) return blocked;
      }
      const epoch = { version: 1, epochId: randomUUID(), operationRunId: input.runId, importCandidateId: input.importCandidateId,
        generation: (existing?.generation ?? 0) + 1, lease: identity, sourceObservation: input.sourceObservation,
        requestedFiles: files, preparedAt: getNow().toISOString(), phase: 'preparing' };
      if (!validatePreProviderEpoch(epoch, { runId: input.runId, importCandidateId: input.importCandidateId })) throw stale();
      if (!await store.saveEpoch({ context, epoch, handoffState: 'preparing', outcome: 'preparing',
        statusMessage: 'Preparing this request before dispatch.', queryable })) throw stale();
      await audit(context, epoch, 'import_execution_preparation_started', queryable);
      return { tracked: true, allowPreparation: true, epochId: epoch.epochId, epoch };
    });
  }
  async function stagePreparationAttempt({ runId, importCandidateId, epochId, lease, attempt, queryable }) {
    const input = { runId, importCandidateId, epochId, lease };
    const context = await store.lockContext({ ...input, queryable });
    const epoch = currentEpoch(context, input);
    if (!owns(context, input, { active: true }) || !epoch || epoch.phase !== 'preparing'
      || hasPreparationProviderEvidence(executionFor(context)) || epoch.attemptId != null
      || !isDeepStrictEqual(epoch.requestedFiles, attempt.requestedFiles)
      || !isDeepStrictEqual(epoch.sourceObservation, attempt.sourceObservation)
      || attempt.operationRunId !== runId || attempt.importCandidateId !== importCandidateId) throw stale();
    return { ...epoch, attemptId: attempt.attemptId };
  }
  async function refusePreparation(input) {
    if (!PRE_PROVIDER_REFUSAL_REASONS.has(input.reasonCode)) throw new TypeError('A bounded preparation refusal reason is required');
    return withTransaction(async (queryable) => {
      const context = await store.lockContext({ ...input, queryable });
      const epoch = currentEpoch(context, input);
      if (!owns(context, input) || !epoch || epoch.phase !== 'preparing'
        || hasPreparationProviderEvidence(executionFor(context), { stagedAttemptId: epoch.attemptId ?? null })) return false;
      const refused = { ...epoch, phase: 'refused', refusal: { reasonCode: input.reasonCode, refusedAt: getNow().toISOString() } };
      if (!validatePreProviderEpoch(refused, { runId: input.runId, importCandidateId: input.importCandidateId })) return false;
      if (!await store.saveEpoch({ context, epoch: refused, itemStatus: 'blocked', outcome: 'pre_provider_refused',
        handoffState: epoch.attemptId ? 'not_dispatched' : 'pre_provider_refused',
        statusMessage: 'This request stopped before any download was sent.', queryable })) throw stale();
      await audit(context, refused, 'import_execution_preparation_refused', queryable);
      return true;
    });
  }
  async function markDispatchPossible(input) {
    return withTransaction(async (queryable) => {
      const context = await store.lockContext({ ...input, queryable });
      const epoch = currentEpoch(context, input);
      const execution = executionFor(context);
      const attempt = validateDownloadAttempt({ attempt: execution.handoff?.attempt, operationRunId: input.runId,
        importCandidateId: input.importCandidateId, requestedFiles: execution.requestedFiles, username: execution.handoff?.attempt?.username });
      if (!owns(context, input, { active: true }) || !epoch || epoch.phase !== 'preparing'
        || epoch.attemptId !== input.attemptId || !attempt || attempt.attemptId !== epoch.attemptId
        || execution.handoff.state !== 'dispatching' || context.candidate?.status !== 'selected'
        || !matchesRecoveryObservation(context.candidate, epoch.sourceObservation)
        || !isDeepStrictEqual(attempt.sourceObservation, epoch.sourceObservation)
        || !isDeepStrictEqual(attempt.requestedFiles, epoch.requestedFiles)
        || hasPreparationProviderEvidence(execution, { stagedAttemptId: epoch.attemptId })
        || !await store.isCurrentOrigin({ operationRunId: input.runId, importCandidateId: input.importCandidateId }, queryable)
        || await store.findUnresolvedOtherHandoff({ operationRunId: input.runId, importCandidateId: input.importCandidateId }, queryable)) throw stale();
      if (input.assertProviderCurrent) await input.assertProviderCurrent({ queryable });
      if (!hasCurrentPreparationLease(context.lease, input.lease, input.runId, getNow().getTime())) throw stale();
      const crossed = { ...epoch, phase: 'may_have_dispatched', dispatchPossibleAt: getNow().toISOString() };
      if (!validatePreProviderEpoch(crossed, { runId: input.runId, importCandidateId: input.importCandidateId })) throw stale();
      if (!await store.saveEpoch({ context, epoch: crossed, queryable })) throw stale();
      await audit(context, crossed, 'import_execution_dispatch_possible', queryable);
      return true;
    });
  }
  return { beginPreparation, refusePreparation, stagePreparationAttempt, markDispatchPossible };
}
