/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { lockAppUserEligibility } from '../app-user-eligibility-lock-store.js';
import { createAcquisitionQualityPolicyService } from '../acquisition/acquisition-quality-policy-service.js';
import { normalizeSavedQualityPreferences } from '../acquisition/acquisition-quality-evidence-policy.js';
import { buildAutomaticLibraryAddAuthority } from './import-candidate-music-queue-auto-safe-add-policy.js';
import { buildRecoveryQualityContext, hasCurrentRecoveryDiscovery, hasCurrentRecoveryRecipients,
  hasOwnedRecoveryOrigin, isValidRecoveryBaseline } from './music-queue-recovery-policy.js';
import { recoveryParticipantSnapshot } from './music-queue-recovery-execution-policy-service.js';
import { buildDownloadAdoptionOutcome, buildDownloadAdoptionRequestHash, buildDownloadAdoptionReviewDigest,
  buildDownloadAdoptionReviewFiles, normalizeDownloadAdoptionCommand, resolveDownloadAdoptionEpisode } from './import-candidate-download-adoption-policy.js';
import { createImportCandidateDownloadAdoptionStore } from './import-candidate-download-adoption-store.js';
import { normalizeDownloadTransferId } from '../slskd/slskd-download-attempt-policy.js';
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

  function identifiers({ operationRunId, importCandidateId, actorUserId, refreshTokenId } = {}) {
    const normalized = Object.fromEntries(Object.entries({ operationRunId, importCandidateId, actorUserId, refreshTokenId })
      .map(([key, value]) => [key, normalizeDownloadTransferId(value)]));
    if (Object.values(normalized).some((id) => !id)) {
      throw createApiError(400, 'validation_error', 'Valid download episode and session identifiers are required');
    }
    return normalized;
  }

  async function actor(input, queryable = null, fresh = false) {
    const value = await store.getActor({ actorUserId: input.actorUserId, refreshTokenId: input.refreshTokenId,
      lock: queryable != null, queryable });
    if (!value || value.role !== 'admin' || value.isDisabled || value.sessionRevoked || value.sessionReplaced
      || !Number.isFinite(Date.parse(value.sessionExpiresAt)) || Date.parse(value.sessionExpiresAt) <= getNow().getTime()) {
      throw createApiError(403, 'admin_required', 'Current administrator access is required');
    }
    if (fresh && value.mustChangePassword) throw createApiError(403, 'reauth_required', 'Re-authentication is required before continuing');
    return value;
  }

  async function policy(episode, currentActor, queryable = null) {
    const { candidate, run } = episode;
    const identity = buildAutomaticLibraryAddAuthority(candidate);
    const owned = hasOwnedRecoveryOrigin(candidate, { summary: run.summary });
    let participants = [];
    let context = { profileCode: 'lossless_archive', qualityOverride: null, minimumBitrateKbps: null };
    if (owned) {
      if (!identity || candidate.normalizedPayload?.requestOwnership?.externalRequestReleaseIntentId) throw stale();
      participants = await store.readParticipantPolicies({ wantedReleaseIds: identity.wantedReleaseIds, queryable });
      if (!hasCurrentRecoveryRecipients(candidate, participants)) throw stale();
      const metadataReleaseId = participants[0]?.metadataReleaseId;
      const record = run.summary?.musicQueueRecovery;
      if (record != null && (!isValidRecoveryBaseline(record.baselineRequirement) || record.retired === true
        || record.metadataReleaseId !== metadataReleaseId || !isDeepStrictEqual(record.authority, identity))) throw stale();
      const discovery = await store.getDiscovery(metadataReleaseId, queryable);
      if (!hasCurrentRecoveryDiscovery(discovery, record?.failedSourceSearchId ?? candidate.sourceSearchId)
        || await store.findActiveSelection({ failedCandidateId: candidate.id, metadataReleaseId, queryable })) throw stale();
      context = await buildRecoveryQualityContext({ failedCandidate: candidate, participants, baselineRequirement: record?.baselineRequirement ?? null });
    } else if (candidate.normalizedPayload?.requestOwnership != null) {
      // An unproven external/request target is not an unowned manual import.
      throw stale();
    }
    const quality = qualityPolicyService.evaluateQualityEvidence({ candidate, profileCode: context.profileCode,
      qualityOverride: context.qualityOverride, minimumBitrateKbps: context.minimumBitrateKbps ?? null });
    if (quality.autoDownloadEligible !== true) throw stale();
    return { participants, context, identity, snapshot: { context,
      participants: recoveryParticipantSnapshot(participants), actorPreferences: normalizeSavedQualityPreferences(currentActor.qualityPreferences) } };
  }

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
