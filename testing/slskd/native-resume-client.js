/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createSlskdService } from '../../src/server/slskd/slskd-service.js';
import { createSlskdClient } from '../../src/server/integrations/slskd/slskd-client.js';
import { createDownloadAttempt, evaluateDownloadReceipt } from '../../src/server/slskd/slskd-download-attempt-policy.js';
import { createSlskdDownloadHandoffReconciliationService } from '../../src/server/slskd/slskd-download-handoff-reconciliation-service.js';
import { classifySlskdTransferState } from '../../src/server/import-candidates/import-candidate-transfer-state-policy.js';
import { nativePeer } from './fixture-data.js';
import { readNativePartialApi } from './native-partial-api.js';

export async function waitForNativeResume(read, accepted) {
  const deadline = performance.now() + 20_000;
  do {
    const value = await read();
    if (accepted(value)) return value;
    await delay(100);
  } while (performance.now() < deadline);
  throw new Error('Native default retry did not reach its bounded checkpoint');
}

export async function runNativeResumeBatch({ plan, config, expectedVersion }) {
  const lost = plan.kind === 'reset';
  let posts = 0; let beforeSend = 0; let postStatus;
  const service = createSlskdService({ getClientConfig: async () => ({ ...config }),
    createSlskdClientFn: options => createSlskdClient({ ...options, fetchImpl: async (url, request) => {
      const response = await fetch(url, request);
      if (request.method === 'POST') {
        posts += 1; postStatus = response.status;
        assert.equal(new URL(url).pathname, '/api/v0/transfers/downloads/batches');
        if (lost) { await response.arrayBuffer(); throw new Error('Controlled loss after native response completion'); }
      }
      return response;
    } }) });
  const dispatch = await service.prepareDownloadDispatch(); assert.equal(dispatch.binding.version, expectedVersion);
  const attempt = createDownloadAttempt({ providerBinding: dispatch.binding, importCandidateId: randomUUID(), operationRunId: randomUUID(),
    username: nativePeer, requestedFiles: [plan.file], sourceObservation: { username: nativePeer } });
  const original = structuredClone(attempt); let direct;
  const started = performance.now();
  const submit = () => dispatch.enqueue({ attempt, beforeSend: async () => { beforeSend += 1; } });
  if (lost) await assert.rejects(submit(), { code: 'slskd_unavailable' });
  else { direct = evaluateDownloadReceipt({ attempt, enqueueResult: await submit() }); assert.equal(direct.disposition, 'confirmed'); }
  const observedStates = new Set();
  const read = async () => {
    const batch = await service.getDownloadBatchEvidence({ attempt });
    if (batch.transfers?.length === 1) observedStates.add(batch.transfers[0].state);
    return batch;
  };
  const first = await waitForNativeResume(read, batch => batch.transfers?.length === 1);
  const initial = first.transfers[0];
  if (direct) assert.equal(initial.id, direct.attempt.receipts[0].id);
  const terminal = await waitForNativeResume(read, batch => batch.transfers?.length === 1 && classifySlskdTransferState(batch.transfers[0]).terminal);
  const row = terminal.transfers[0];
  assert.equal(terminal.id, attempt.attemptId); assert.equal(row.id, initial.id); assert.equal(row.batchId, attempt.attemptId);
  assert.equal(row.filename, plan.file.filename); assert.equal(row.size, plan.file.size);
  assert.equal(classifySlskdTransferState(row).code, 'succeeded'); assert.equal(row.bytesTransferred, plan.file.size);
  const raw = await readNativePartialApi(config, 'transfers/downloads/' + encodeURIComponent(nativePeer) + '/' + encodeURIComponent(row.id));
  assert.equal(raw.attempts, 2);
  const request = { id: row.id, username: nativePeer, filename: row.filename, size: row.size, batchId: attempt.attemptId, providerBinding: dispatch.binding };
  const bound = await service.getBoundDownload(request);
  assert.equal(bound.id, row.id); assert.equal(bound.exception, null);
  for (const change of [{ id: randomUUID() }, { batchId: randomUUID() }, { size: row.size + 1 }, { filename: 'Other.bin' }, { username: 'other-peer' }]) {
    assert.equal(await service.getBoundDownload({ ...request, ...change }), null);
  }
  const recovery = await createSlskdDownloadHandoffReconciliationService({ getDownloadBatchEvidence: service.getDownloadBatchEvidence })
    .findMatchingTransfers({ attempt, ...attempt });
  assert.equal(recovery.disposition, 'confirmed'); assert.equal(recovery.attempt.receipts[0].id, row.id);
  assert.equal(posts, 1); assert.equal(postStatus, 201); assert.equal(beforeSend, 1); assert.deepEqual(attempt, original);
  return { kind: plan.kind, lostResponse: lost, posts, postStatus, beforeSend, filename: row.filename, size: row.size, bytesTransferred: row.bytesTransferred,
    state: row.state, nativeAttempts: raw.attempts, localRequeueObserved: observedStates.has('Queued, Locally'),
    observedStates: [...observedStates], receiptIdentityStable: true,
    classification: 'succeeded', recoveryDisposition: recovery.disposition, elapsedMs: performance.now() - started };
}
