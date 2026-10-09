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
import { lockAppUserEligibility } from '../app-user-eligibility-lock-store.js';
import { evaluateBatchDownloadEvidence } from '../slskd/slskd-download-batch-policy.js';
import { createImportExecutionDownloadAuthorityService, normalizeDownloadCommandContext } from './import-execution-download-authority-service.js';
import { createImportCandidateDownloadOriginStore } from './import-candidate-download-origin-store.js';
import { hasReciprocalExecutionOriginResolution } from './import-execution-origin-policy.js';
import { normalizeDownloadOriginCommand, resolveDownloadOriginEpisode, buildDownloadOriginReviewDigest,
  buildDownloadOriginRequestHash, buildDownloadOriginOutcome } from './import-candidate-download-origin-policy.js';

const stale = () => createApiError(409, 'import_execution_download_origin_not_current', 'The reviewed download requests changed. Review them again before continuing.');
const unproven = () => createApiError(409, 'import_execution_download_origin_evidence_not_current', 'The earlier download request has no complete current batch evidence');

/** Restore one exact earlier owner; never perform or authorize another provider command. */
export function createImportCandidateDownloadOriginService({ store = createImportCandidateDownloadOriginStore(),
  prepareDownloadDispatch, getDownloadBatchEvidence, confirmDownloadHandoff, assertMaintenanceWriteAllowed,
  withTransaction = createDatabaseTransactionRunner(), lockAccounts = lockAppUserEligibility,
  recordAuditEventFn = recordAuditEvent, qualityPolicyService, getNow = () => new Date() } = {}) {
  for (const [name, fn] of Object.entries({ prepareDownloadDispatch, getDownloadBatchEvidence, confirmDownloadHandoff,
    assertMaintenanceWriteAllowed, withTransaction, lockAccounts, recordAuditEventFn,
    getReviewContext: store.getReviewContext, lockContext: store.lockContext, retireUnusedAllocation: store.retireUnusedAllocation,
    lockParticipantReleases: store.lockParticipantReleases })) {
    if (typeof fn !== 'function') throw new TypeError(`Download origin resolution requires ${name}`);
  }
  const { actor, policy } = createImportExecutionDownloadAuthorityService({ store, getNow, qualityPolicyService, createStaleError: stale });
  const episodeFor = (context) => resolveDownloadOriginEpisode(context, { now: getNow().getTime() });
  const readContext = (input) => store.getReviewContext({ importCandidateId: input.importCandidateId, operationRunId: input.operationRunId });
  const lockContext = (input, newerRunId, queryable) => store.lockContext({ importCandidateId: input.importCandidateId,
    sourceRunId: input.operationRunId, newerRunId, queryable });
  const proofFor = (episode, rawEvidence) => {
    const proof = evaluateBatchDownloadEvidence({ attempt: episode.attempt, providerEvidence: rawEvidence });
    if (proof?.disposition !== 'confirmed' || proof.allRequestedFilesMatched !== true) throw unproven();
    return proof;
  };
  async function providerEvidence(episode) {
    const prepared = await prepareDownloadDispatch(); // Version/binding read only; never call enqueue.
    if (!isDeepStrictEqual(prepared.binding, episode.attempt.providerBinding)) throw stale();
    if (typeof prepared.assertCurrent !== 'function') throw createApiError(503, 'slskd_download_provider_changed', 'The Downloader binding cannot be verified');
    const raw = await getDownloadBatchEvidence({ attempt: episode.attempt });
    proofFor(episode, raw);
    await prepared.assertCurrent();
    return { raw, assertCurrent: prepared.assertCurrent };
  }
  const digestFor = (input, context, episode, currentPolicy, proof) => buildDownloadOriginReviewDigest({
    actorUserId: input.actorUserId, context, episode, policySnapshot: currentPolicy.snapshot, proof });
  function replay(context, input, requestHash) {
    const saved = context.savedResolution;
    if (!saved) return null;
    const outcome = saved.publicOutcome?.downloadOriginResolution;
    if (saved.requestHash !== requestHash || saved.actorUserId !== input.actorUserId
      || !hasReciprocalExecutionOriginResolution({ record: saved, sourceItem: context.sourceItem,
        newerRun: context.newerRun, importCandidateId: input.importCandidateId })
      || saved.sourceRunId !== input.operationRunId || outcome?.operationRunId !== input.operationRunId
      || outcome.importCandidateId !== input.importCandidateId || outcome.outcome !== 'restored'
      || !Number.isInteger(outcome.verifiedFileCount) || outcome.verifiedFileCount < 1 || outcome.verifiedFileCount > 200
      || outcome.retiredRequestCount !== 1) throw stale();
    return buildDownloadOriginOutcome({ ...input, verifiedFileCount: outcome.verifiedFileCount, replayed: true });
  }
  async function getDownloadOriginReview(input) {
    input = { ...input, ...normalizeDownloadCommandContext(input) };
    const initialActor = await actor(input);
    const context = await readContext(input);
    const episode = episodeFor(context);
    const base = { operationRunId: input.operationRunId, importCandidateId: input.importCandidateId,
      canRestore: false, reasonCode: episode.reasonCode, reviewDigest: null, verifiedFileCount: 0, retiredRequestCount: 0 };
    if (!episode.eligible) return { downloadOriginReview: base };
    try {
      await policy(episode, initialActor);
      const evidence = await providerEvidence(episode);
      const currentActor = await actor(input);
      const currentContext = await readContext(input);
      const currentEpisode = episodeFor(currentContext);
      if (!currentEpisode.eligible) return { downloadOriginReview: { ...base, reasonCode: currentEpisode.reasonCode } };
      const currentPolicy = await policy(currentEpisode, currentActor);
      const proof = proofFor(currentEpisode, evidence.raw);
      await evidence.assertCurrent();
      return { downloadOriginReview: { ...base, canRestore: true, reasonCode: null, retiredRequestCount: 1,
        verifiedFileCount: proof.requestedFileCount, reviewDigest: digestFor(input, currentContext, currentEpisode, currentPolicy, proof) } };
    } catch (error) {
      if (error.code !== 'import_execution_download_origin_not_current' && error.code !== 'import_execution_download_origin_evidence_not_current') throw error;
      return { downloadOriginReview: { ...base, reasonCode: error.code } };
    }
  }
  async function resolveDownloadOrigin(input) {
    input = { ...input, ...normalizeDownloadCommandContext(input) };
    const command = normalizeDownloadOriginCommand(input.command);
    const requestHash = buildDownloadOriginRequestHash({ ...input, command });
    const currentActor = await actor(input, null, true);
    const context = await readContext(input);
    if (context.savedResolution) {
      return withTransaction(async (queryable) => {
        await lockAccounts({ userIds: [input.actorUserId], queryable });
        await actor(input, queryable, true);
        const saved = replay(await lockContext(input, context.savedResolution.newerRunId, queryable), input, requestHash);
        if (!saved) throw stale();
        return saved;
      });
    }
    const episode = episodeFor(context);
    if (!episode.eligible) throw stale();
    const preparedPolicy = await policy(episode, currentActor);
    const evidence = await providerEvidence(episode);
    if (digestFor(input, context, episode, preparedPolicy, proofFor(episode, evidence.raw)) !== command.reviewDigest) throw stale();
    return withTransaction(async (queryable) => {
      await assertMaintenanceWriteAllowed({ queryable });
      await lockAccounts({ userIds: [...new Set([input.actorUserId,
        ...preparedPolicy.participants.map((participant) => participant.appUserId)])], queryable });
      const freshActor = await actor(input, queryable, true);
      if (preparedPolicy.identity) await store.lockParticipantReleases({ wantedReleaseIds: preparedPolicy.identity.wantedReleaseIds, queryable });
      const current = await lockContext(input, episode.newerRun.id, queryable);
      const saved = replay(current, input, requestHash);
      if (saved) return saved;
      const freshEpisode = episodeFor(current);
      if (!freshEpisode.eligible) throw stale();
      const freshPolicy = await policy(freshEpisode, freshActor, queryable);
      const proof = proofFor(freshEpisode, evidence.raw);
      if (digestFor(input, current, freshEpisode, freshPolicy, proof) !== command.reviewDigest) throw stale();
      await evidence.assertCurrent({ queryable });
      const outcome = buildDownloadOriginOutcome({ ...input, verifiedFileCount: proof.requestedFileCount });
      const retired = await store.retireUnusedAllocation({ context: current, resolutionId: randomUUID(), requestHash,
        actorUserId: input.actorUserId, publicOutcome: outcome, queryable });
      if (!retired) throw stale();
      const confirmed = await confirmDownloadHandoff({ operationRunId: input.operationRunId, importCandidateId: input.importCandidateId,
        attemptId: freshEpisode.attempt.attemptId, expectedAttempt: freshEpisode.attempt, providerEvidence: evidence.raw,
        actorUserId: input.actorUserId, requestMetadata: input.requestMetadata, queryable });
      if (confirmed?.confirmed !== true) throw stale();
      await recordAuditEventFn({ actorType: 'user', actorUserId: input.actorUserId,
        eventType: 'import_execution_origin_restored', entityType: 'operation_run', entityId: input.operationRunId,
        summary: 'An administrator restored a verified download request',
        details: { importCandidateId: input.importCandidateId, retiredOperationRunId: freshEpisode.newerRun.id,
          verifiedFileCount: proof.requestedFileCount }, ipAddress: input.requestMetadata?.ipAddress ?? null,
        userAgent: input.requestMetadata?.userAgent ?? null }, queryable);
      return outcome;
    });
  }
  return { getDownloadOriginReview, resolveDownloadOrigin };
}
