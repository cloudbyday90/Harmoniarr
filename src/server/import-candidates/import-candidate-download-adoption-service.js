/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { createAcquisitionQualityPolicyService } from '../acquisition/acquisition-quality-policy-service.js';
import { createImportExecutionDownloadAuthorityService, normalizeDownloadCommandContext } from './import-execution-download-authority-service.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { lockAppUserEligibility } from '../app-user-eligibility-lock-store.js';
import { buildDownloadAdoptionOutcome, buildDownloadAdoptionRequestHash, buildDownloadAdoptionReviewDigest,
  buildDownloadAdoptionReviewFiles, normalizeDownloadAdoptionCommand, resolveDownloadAdoptionEpisode } from './import-candidate-download-adoption-policy.js';
import { createImportCandidateDownloadAdoptionStore } from './import-candidate-download-adoption-store.js';
import { validateDownloadAdoptionSelection } from '../slskd/slskd-download-adoption-policy.js';

const stale = () => createApiError(409, 'import_execution_download_adoption_not_current', 'The reviewed download handoff changed. Review it again before continuing.');

/** Explicit operator reuse never makes a claim about the original uncertain POST. */
export function createImportCandidateDownloadAdoptionService({ store = createImportCandidateDownloadAdoptionStore(),
  adoptDownloadHandoff, listAdoptionTransfers, validateSelectedAdoptionTransfers, assertMaintenanceWriteAllowed,
  withTransaction = createDatabaseTransactionRunner(), lockAccounts = lockAppUserEligibility,
  qualityPolicyService = createAcquisitionQualityPolicyService(), getNow = () => new Date() } = {}) {
  for (const [name, fn] of Object.entries({ adoptDownloadHandoff, listAdoptionTransfers, validateSelectedAdoptionTransfers,
    assertMaintenanceWriteAllowed, withTransaction, lockAccounts, getActor: store.getActor, getEpisode: store.getEpisode,
    lockEpisode: store.lockEpisode, readParticipantPolicies: store.readParticipantPolicies,
    lockParticipantReleases: store.lockParticipantReleases, getDiscovery: store.getDiscovery, findActiveSelection: store.findActiveSelection,
    hasForeignBatchAttempt: store.hasForeignBatchAttempt })) {
    if (typeof fn !== 'function') throw new TypeError(`Download adoption requires ${name}`);
  }

  const { actor, policy } = createImportExecutionDownloadAuthorityService({ store, getNow, qualityPolicyService, createStaleError: stale });
  const identifiers = normalizeDownloadCommandContext;

  async function providerReview(episode, selectedIds = null, binding = null) {
    const listed = await listAdoptionTransfers({ requestedFiles: episode.requestedFiles, username: episode.username });
    if (binding && !isDeepStrictEqual(listed.binding, binding)) throw stale();
    const files = buildDownloadAdoptionReviewFiles({ requestedFiles: episode.requestedFiles, transfers: listed.transfers });
    const ids = selectedIds ?? files.map((file) => file.choices[0].id);
    const evidence = await validateSelectedAdoptionTransfers({ requestedFiles: episode.requestedFiles,
      username: episode.username, transferIds: ids, providerBinding: listed.binding });
    if (evidence?.allRequestedFilesMatched !== true || evidence.source !== 'operator_adoption'
      || evidence.requestedFileCount !== episode.requestedFiles.length || !isDeepStrictEqual(evidence.binding, listed.binding)
      || !Array.isArray(evidence.receipts) || evidence.receipts.length !== episode.requestedFiles.length) throw stale();
    validateDownloadAdoptionSelection({ requestedFiles: episode.requestedFiles, username: episode.username,
      transferIds: ids, transfers: evidence.receipts, providerBinding: evidence.binding });
    if (await store.hasForeignBatchAttempt({ importCandidateId: episode.candidate.id, operationRunId: episode.run.id,
      providerBinding: evidence.binding, transfers: evidence.receipts })) throw stale();
    return { files, evidence, choices: evidence.receipts };
  }

  async function getDownloadAdoptionReview(input) {
    input = { ...input, ...identifiers(input) };
    const currentActor = await actor(input);
    const raw = await store.getEpisode(input);
    const episode = resolveDownloadAdoptionEpisode(raw);
    const base = { operationRunId: input.operationRunId, importCandidateId: input.importCandidateId,
      canAdopt: false, reasonCode: episode.reasonCode, requestedFileCount: 0, files: [] };
    if (!episode.eligible) return { downloadAdoptionReview: base };
    let currentPolicy;
    try { currentPolicy = await policy(episode, currentActor); }
    catch (error) { if (error.code !== 'import_execution_download_adoption_not_current') throw error;
      return { downloadAdoptionReview: { ...base, reasonCode: 'download_policy_not_current' } }; }
    const provider = await providerReview(episode);
    const finalActor = await actor(input);
    const finalEpisode = resolveDownloadAdoptionEpisode(await store.getEpisode(input));
    if (!finalEpisode.eligible) return { downloadAdoptionReview: { ...base, reasonCode: finalEpisode.reasonCode } };
    try { currentPolicy = await policy(finalEpisode, finalActor); }
    catch (error) { if (error.code !== 'import_execution_download_adoption_not_current') throw error;
      return { downloadAdoptionReview: { ...base, reasonCode: 'download_policy_not_current' } }; }
    const reviewDigest = buildDownloadAdoptionReviewDigest({ actorUserId: input.actorUserId, episode: finalEpisode,
      providerBinding: provider.evidence.binding, policySnapshot: currentPolicy.snapshot, choices: provider.choices });
    return { downloadAdoptionReview: { ...base, canAdopt: true, reasonCode: null, reviewDigest,
      requestedFileCount: episode.requestedFiles.length, files: provider.files } };
  }

  function savedReplay(raw, requestHash, input) {
    const saved = raw.item?.planningSnapshot?.execution?.handoff?.adoption;
    if (!saved) return null;
    if (saved.requestHash !== requestHash) throw stale();
    return buildDownloadAdoptionOutcome({ ...input, adoptedFileCount: saved.receipts?.length ?? 0, replayed: true });
  }

  async function adoptExistingDownloads(input) {
    input = { ...input, ...identifiers(input) };
    const command = normalizeDownloadAdoptionCommand(input.command);
    const requestHash = buildDownloadAdoptionRequestHash({ ...input, command });
    const currentActor = await actor(input, null, true);
    const raw = await store.getEpisode(input);
    if (raw.item?.planningSnapshot?.execution?.handoff?.adoption) {
      return withTransaction(async (queryable) => {
        await lockAccounts({ userIds: [input.actorUserId], queryable });
        await actor(input, queryable, true);
        return savedReplay(await store.lockEpisode({ ...input, queryable }), requestHash, input);
      });
    }
    const episode = resolveDownloadAdoptionEpisode(raw);
    if (!episode.eligible) throw stale();
    const preparedPolicy = await policy(episode, currentActor);
    const provider = await providerReview(episode, command.transferIds);
    const digest = (scope, policySnapshot) => buildDownloadAdoptionReviewDigest({ actorUserId: input.actorUserId,
      episode: scope, providerBinding: provider.evidence.binding, policySnapshot, choices: provider.choices });
    if (digest(episode, preparedPolicy.snapshot) !== command.reviewDigest) throw stale();
    return withTransaction(async (queryable) => {
      await assertMaintenanceWriteAllowed({ queryable });
      await lockAccounts({ userIds: [...new Set([input.actorUserId, ...preparedPolicy.participants.map((row) => row.appUserId)])], queryable });
      const freshActor = await actor(input, queryable, true);
      if (preparedPolicy.identity) await store.lockParticipantReleases({ wantedReleaseIds: preparedPolicy.identity.wantedReleaseIds, queryable });
      const freshRaw = await store.lockEpisode({ ...input, queryable });
      const replay = savedReplay(freshRaw, requestHash, input);
      if (replay) return replay;
      const freshEpisode = resolveDownloadAdoptionEpisode(freshRaw);
      if (!freshEpisode.eligible) throw stale();
      const freshPolicy = await policy(freshEpisode, freshActor, queryable);
      if (digest(freshEpisode, freshPolicy.snapshot) !== command.reviewDigest) throw stale();
      const adopted = await adoptDownloadHandoff({ importCandidateId: input.importCandidateId, operationRunId: input.operationRunId,
        actorUserId: input.actorUserId, selectedTransfers: provider.evidence.receipts, providerBinding: provider.evidence.binding,
        adoptionRequestHash: requestHash, sourceObservation: freshEpisode.sourceObservation,
        requestedFiles: freshEpisode.requestedFiles, qualityContext: freshPolicy.context,
        publicOutcome: buildDownloadAdoptionOutcome({ ...input, adoptedFileCount: freshEpisode.requestedFiles.length }),
        requestMetadata: input.requestMetadata, queryable });
      if (adopted?.adopted !== true) throw stale();
      return buildDownloadAdoptionOutcome({ ...input, adoptedFileCount: freshEpisode.requestedFiles.length, replayed: adopted.replayed === true });
    });
  }
  return { getDownloadAdoptionReview, adoptExistingDownloads };
}
