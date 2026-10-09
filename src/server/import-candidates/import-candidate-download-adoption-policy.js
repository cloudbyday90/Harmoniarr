/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createHash } from 'node:crypto';
import { createApiError } from '../auth.js';
import { normalizeDownloadTransferId } from '../slskd/slskd-download-attempt-policy.js';
import { MAX_DOWNLOAD_ADOPTION_FILES } from '../slskd/slskd-download-adoption-policy.js';
import { isUnconfirmedExecutionItem } from './import-candidate-execution-handoff-state.js';
import { matchesAcceptedRecoveryProvenance } from './music-queue-recovery-policy.js';

export { MAX_DOWNLOAD_ADOPTION_FILES };
const terminalRuns = new Set(['completed', 'failed', 'cancelled']);
const plain = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const refuse = (reasonCode) => ({ eligible: false, reasonCode });

/** An adoption command has no caller-supplied source, manifest, policy or target. */
export function normalizeDownloadAdoptionCommand(value) {
  if (!plain(value) || Object.keys(value).some((key) => !['reviewDigest', 'transferIds'].includes(key))
    || typeof value.reviewDigest !== 'string' || !/^[a-f0-9]{64}$/iu.test(value.reviewDigest)
    || !Array.isArray(value.transferIds) || !value.transferIds.length
    || value.transferIds.length > MAX_DOWNLOAD_ADOPTION_FILES) {
    throw createApiError(400, 'validation_error', 'Use the reviewed digest and transfer identifiers to adopt existing downloads');
  }
  const transferIds = value.transferIds.map(normalizeDownloadTransferId);
  if (transferIds.some((id) => !id) || new Set(transferIds).size !== transferIds.length) {
    throw createApiError(400, 'validation_error', 'Download adoption requires unique valid transfer identifiers');
  }
  return { reviewDigest: value.reviewDigest.toLowerCase(), transferIds: transferIds.sort() };
}

export function normalizeDownloadAdoptionManifest(files) {
  if (!Array.isArray(files) || !files.length || files.length > MAX_DOWNLOAD_ADOPTION_FILES) return null;
  const manifest = files.map((file) => {
    const name = file?.filename;
    return typeof name === 'string' && name.trim() && name.length <= 4096 && !name.includes('\u0000')
      && Number.isSafeInteger(file.size) && file.size > 0
      ? { filename: name.trim().replaceAll('/', '\\'), size: file.size } : null;
  });
  return manifest.some((file) => !file) || new Set(manifest.map((file) => file.filename)).size !== manifest.length
    ? null : manifest;
}

/** Original immutable evidence is required; historical omissions are never backfilled. */
export function resolveDownloadAdoptionEpisode({ candidate, item, run, currentOriginId } = {}) {
  if (!candidate || !item || !run || run.operationType !== 'import_candidate_execution_planning'
    || item.operationRunId !== run.id || item.importCandidateId !== candidate.id) return refuse('download_episode_not_available');
  if (!terminalRuns.has(run.status)) return refuse('active_download_work');
  if (currentOriginId !== run.id) return refuse('download_episode_not_current');
  if (candidate.status !== 'selected' || !isUnconfirmedExecutionItem(item)
    || item.planningSnapshot?.execution?.handoff?.adoption != null) return refuse('download_episode_not_available');
  const execution = item.planningSnapshot?.execution;
  const requestedFiles = normalizeDownloadAdoptionManifest(execution?.requestedFiles);
  const sourceObservation = execution?.handoff?.attempt?.sourceObservation ?? execution?.sourceObservation;
  if (!requestedFiles || !plain(sourceObservation) || !matchesAcceptedRecoveryProvenance(candidate, sourceObservation)
    || typeof sourceObservation.username !== 'string' || !sourceObservation.username.trim()) return refuse('immutable_download_evidence_missing');
  const currentFiles = normalizeDownloadAdoptionManifest((candidate.files ?? []).filter((file) => !file.isLocked).map((file) => ({
    filename: file.rawPayload?.filename ?? (file.folderPath ? `${file.folderPath}\\${file.filename}` : file.filename), size: file.sizeBytes,
  })));
  if (!currentFiles || JSON.stringify(currentFiles) !== JSON.stringify(requestedFiles)) return refuse('immutable_download_evidence_missing');
  return { eligible: true, reasonCode: null, requestedFiles, sourceObservation,
    username: sourceObservation.username, candidate, item, run };
}

function stableSource(observation) {
  const source = { ...observation };
  delete source.status;
  delete source.updatedAt;
  return source;
}

export function buildDownloadAdoptionReviewDigest({ actorUserId, episode, providerBinding, policySnapshot, choices }) {
  return createHash('sha256').update(JSON.stringify({ version: 1, actorUserId,
    importCandidateId: episode.candidate.id, operationRunId: episode.run.id,
    attemptId: episode.item.planningSnapshot?.execution?.handoff?.attempt?.attemptId ?? null,
    requestedFiles: episode.requestedFiles, sourceObservation: stableSource(episode.sourceObservation),
    runAuthority: { triggerSource: episode.run.summary?.triggerSource ?? null,
      sourceWantedReleaseId: episode.run.summary?.sourceWantedReleaseId ?? null,
      musicQueueRecovery: episode.run.summary?.musicQueueRecovery ?? null },
    providerBinding, policySnapshot,
    choices: choices.map((row) => ({ id: row.id, username: row.username, filename: row.filename,
      size: row.size, ...(row.batchId != null ? { batchId: row.batchId } : {}) })).sort((a, b) => a.id.localeCompare(b.id)),
  })).digest('hex');
}

export function buildDownloadAdoptionRequestHash({ actorUserId, operationRunId, importCandidateId, command }) {
  return createHash('sha256').update(JSON.stringify({ actorUserId, operationRunId, importCandidateId, ...command })).digest('hex');
}

export function buildDownloadAdoptionReviewFiles({ requestedFiles, transfers }) {
  return requestedFiles.map((file) => {
    const matches = transfers.filter((row) => row.filename?.replaceAll('/', '\\') === file.filename && row.size === file.size);
    if (matches.length !== 1) throw createApiError(409, 'import_execution_download_adoption_evidence_not_current', 'The existing download evidence is incomplete or ambiguous');
    const row = matches[0];
    const flags = row.state?.split(',').map((flag) => flag.trim()) ?? [];
    const stateLabel = flags.includes('Succeeded') ? 'Downloaded'
      : flags.includes('InProgress') ? 'Downloading' : 'Queued remotely';
    return { label: file.filename.split('\\').at(-1).slice(0, 512), size: file.size,
      choices: [{ id: row.id, stateLabel }] };
  });
}

export function buildDownloadAdoptionOutcome({ operationRunId, importCandidateId, adoptedFileCount, replayed = false }) {
  return { downloadAdoption: { outcome: 'adopted', operationRunId, importCandidateId, adoptedFileCount, replayed } };
}
