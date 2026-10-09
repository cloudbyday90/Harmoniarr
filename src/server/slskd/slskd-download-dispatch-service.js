/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createApiError } from '../auth.js';
import { createSlskdProviderBinding, assertSlskdProviderBindingCurrent } from './slskd-download-protocol-policy.js';
import { decodeSlskdDownloadBatchResponse } from './slskd-download-batch-policy.js';
import { matchesDownloadReceipt, normalizeDownloadFileManifest, normalizeDownloadTransferId } from './slskd-download-attempt-policy.js';
import { normalizeSlskdDownloadTransfer } from './slskd-download-transfer-policy.js';
import { hasKnownDownloadState } from './slskd-download-evidence-policy.js';
import { validateDownloadAdoptionSelection, MAX_DOWNLOAD_ADOPTION_FILES } from './slskd-download-adoption-policy.js';

const invalidSnapshot = () => { throw createApiError(502, 'slskd_download_snapshot_invalid', 'Downloader returned an unverifiable download snapshot'); };

function readStrictAdoptionSnapshot(payload, username) {
  const groups = Array.isArray(payload) ? payload : payload && typeof payload === 'object' ? [payload] : null;
  if (!groups) return invalidSnapshot();
  const transfers = [];
  const identities = new Set();
  for (const group of groups) {
    if (group?.username !== username || !Array.isArray(group.directories)) return invalidSnapshot();
    for (const directory of group.directories) {
      if (!Array.isArray(directory?.files)) return invalidSnapshot();
      for (const row of directory.files) {
        const id = normalizeDownloadTransferId(row?.id);
        if (!id || identities.has(id) || row.username !== username || row.direction !== 'Download'
          || typeof row.filename !== 'string' || !row.filename.trim() || row.filename.length > 4096
          || !Number.isSafeInteger(row.size) || row.size < 0 || typeof row.state !== 'string'
          || typeof row.removed !== 'boolean' || (row.exception != null && typeof row.exception !== 'string')
          || transfers.length >= 20000) return invalidSnapshot();
        identities.add(id);
        transfers.push({ ...normalizeSlskdDownloadTransfer(row), id });
      }
    }
  }
  return transfers;
}

export function createSlskdDownloadDispatchService({ captureProvider, normalizeLegacyReceipt,
  observe = (work) => work() } = {}) {
  if (typeof captureProvider !== 'function' || typeof normalizeLegacyReceipt !== 'function') throw new TypeError('Download dispatch requires a pinned provider adapter');

  async function prepareDownloadDispatch() {
    const pinned = await captureProvider();
    const version = await observe(() => pinned.client.getApplicationVersion());
    const binding = createSlskdProviderBinding({ config: pinned.config, version });
    await pinned.assertCurrent(binding, { requireCredentials: true });
    return {
      binding,
      assertCurrent: ({ queryable } = {}) => pinned.assertCurrent(binding, { requireCredentials: true, queryable }),
      enqueue: async ({ attempt }) => {
        if (attempt?.providerBinding?.protocol !== binding.protocol || attempt.providerBinding.version !== binding.version
          || attempt.providerBinding.endpointFingerprint !== binding.endpointFingerprint) throw createApiError(409, 'slskd_download_attempt_binding_invalid', 'The saved download transport changed');
        await pinned.assertCurrent(binding, { requireCredentials: true });
        if (binding.protocol === 'legacy') return normalizeLegacyReceipt(await observe(() => pinned.client.enqueueDownloads({
          files: attempt.requestedFiles, username: attempt.username,
        })));
        try {
          return decodeSlskdDownloadBatchResponse({ attempt, payload: await observe(() => pinned.client.enqueueDownloadBatch({
            id: attempt.attemptId, files: attempt.requestedFiles, username: attempt.username,
          })) });
        } catch (error) {
          if (error?.details?.status === 409) return { enqueued: [], failed: [], batchConflict: true };
          throw error;
        }
      },
    };
  }

  async function getDownloadBatchEvidence({ attempt }) {
    const pinned = await captureProvider();
    assertSlskdProviderBindingCurrent({ binding: attempt?.providerBinding, config: pinned.config });
    if (attempt.providerBinding.protocol !== 'batch') throw createApiError(409, 'slskd_download_attempt_binding_invalid', 'This request has no provider batch');
    const payload = await observe(() => pinned.client.getDownloadBatch({ id: attempt.attemptId }));
    await pinned.assertCurrent(attempt.providerBinding);
    return payload;
  }

  async function getBoundDownload({ id, username, filename, size, batchId, providerBinding = null }) {
    const pinned = await captureProvider();
    if (providerBinding) assertSlskdProviderBindingCurrent({ binding: providerBinding, config: pinned.config });
    const normalizedId = normalizeDownloadTransferId(id);
    if (!normalizedId || typeof username !== 'string' || !username.trim()) return null;
    let payload;
    try { payload = await observe(() => pinned.client.getDownload({ id: normalizedId, username })); }
    catch (error) { if (error?.details?.status === 404) return null; throw error; }
    if (providerBinding) await pinned.assertCurrent(providerBinding);
    if (normalizeDownloadTransferId(payload?.id) !== normalizedId || payload?.username !== username
      || payload?.direction !== 'Download' || !hasKnownDownloadState(payload)
      || !Number.isSafeInteger(payload?.size) || payload.size <= 0
      || typeof payload?.filename !== 'string' || !payload.filename.trim()) return null;
    if (payload.batchId != null && !normalizeDownloadTransferId(payload.batchId)) return null;
    if (batchId != null && normalizeDownloadTransferId(payload.batchId) !== normalizeDownloadTransferId(batchId)) return null;
    if ((filename != null || size != null) && !matchesDownloadReceipt({
      receipt: { id: normalizedId, username, filename, size, ...(batchId ? { batchId } : {}) },
      transfer: payload, requireDirection: true,
    })) return null;
    return { ...normalizeSlskdDownloadTransfer(payload), id: normalizedId };
  }

  async function getBoundDownloads({ requestedTransfers = [] } = {}) {
    if (!Array.isArray(requestedTransfers) || requestedTransfers.length > 10000) return invalidSnapshot();
    const transfers = [];
    const observations = [];
    const unique = [...new Map(requestedTransfers.filter((row) => normalizeDownloadTransferId(row?.id) && row?.username)
      .map((row) => [`${row.providerBinding?.endpointFingerprint ?? ''}\u0000${row.username}\u0000${normalizeDownloadTransferId(row.id)}`, row])).values()];
    for (let offset = 0; offset < unique.length; offset += 8) {
      const requests = unique.slice(offset, offset + 8);
      const rows = await Promise.all(requests.map(async (request) => {
        try { return { request, transfer: await getBoundDownload(request) }; }
        catch (error) {
          if (typeof error?.code !== 'string' || !error.code.startsWith('slskd_')) throw error;
          return { request, transfer: null, issue: 'provider_unavailable' };
        }
      }));
      observations.push(...rows.map((row) => ({ ...row, issue: row.issue ?? (row.transfer ? null : 'unverified') })));
      transfers.push(...rows.map((row) => row.transfer).filter(Boolean));
    }
    return { transfers, observations };
  }

  async function listAdoptionTransfers({ requestedFiles, username }) {
    const files = normalizeDownloadFileManifest(requestedFiles);
    if (!files || files.length > MAX_DOWNLOAD_ADOPTION_FILES) throw createApiError(409, 'import_execution_download_adoption_evidence_not_current', 'The saved download manifest is unavailable or too large for review');
    const pinned = await captureProvider();
    const version = await observe(() => pinned.client.getApplicationVersion());
    const binding = createSlskdProviderBinding({ config: pinned.config, version });
    const rows = readStrictAdoptionSnapshot(await observe(() => pinned.client.getDownloads({ username })), username);
    await pinned.assertCurrent(binding);
    return { binding, transfers: rows.filter((row) => files.some((file) => file.filename === row.filename.trim().replaceAll('/', '\\'))) };
  }

  async function validateSelectedAdoptionTransfers({ requestedFiles, username, transferIds, providerBinding }) {
    const snapshot = await listAdoptionTransfers({ requestedFiles, username });
    if (snapshot.binding.endpointFingerprint !== providerBinding?.endpointFingerprint
      || snapshot.binding.version !== providerBinding.version || snapshot.binding.protocol !== providerBinding.protocol) {
      throw createApiError(503, 'slskd_download_provider_changed', 'The Downloader connection changed; review the downloads again');
    }
    const proof = validateDownloadAdoptionSelection({ requestedFiles, username, transferIds, transfers: snapshot.transfers, providerBinding });
    const observed = await getBoundDownloads({ requestedTransfers: proof.receipts.map((row) => ({ ...row, providerBinding })) });
    return validateDownloadAdoptionSelection({ requestedFiles, username, transferIds, transfers: observed.transfers, providerBinding });
  }
  return { prepareDownloadDispatch, getDownloadBatchEvidence, getBoundDownload, getBoundDownloads,
    listAdoptionTransfers, validateSelectedAdoptionTransfers };
}
