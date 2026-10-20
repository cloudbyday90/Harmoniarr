/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createSlskdService } from '../../src/server/slskd/slskd-service.js';
import { createSlskdClient } from '../../src/server/integrations/slskd/slskd-client.js';
import { createDownloadAttempt, evaluateDownloadReceipt } from '../../src/server/slskd/slskd-download-attempt-policy.js';
import { createSlskdDownloadHandoffReconciliationService } from '../../src/server/slskd/slskd-download-handoff-reconciliation-service.js';
import { hasProgressedDownloadEvidence } from '../../src/server/slskd/slskd-download-evidence-policy.js';
import { classifySlskdTransferState } from '../../src/server/import-candidates/import-candidate-transfer-state-policy.js';
import { nativePeer } from './fixture-data.js';
import { waitForNativeResume } from './native-resume-client.js';
import { readNativePartialApi } from './native-partial-api.js';

export async function runNativeRefusalBatch({ plan, config, expectedVersion }) {
  const file = plan.partial.file; const lost = plan.kind === 'size-change';
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
    username: nativePeer, requestedFiles: [file], sourceObservation: { username: nativePeer } });
  const original = structuredClone(attempt); let direct;
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
  const batch = await waitForNativeResume(read, value => value.transfers?.length === 1 && classifySlskdTransferState(value.transfers[0]).terminal);
  const row = batch.transfers[0];
  assert.equal(batch.id, attempt.attemptId); assert.equal(row.id, initial.id); assert.equal(row.batchId, attempt.attemptId);
  const request = { id: row.id, username: nativePeer, filename: file.filename, size: file.size, batchId: attempt.attemptId, providerBinding: dispatch.binding };
  const bound = await service.getBoundDownload(request);
  assert.ok(bound); assert.equal(bound.id, row.id); assert.equal(bound.batchId, attempt.attemptId);
  assert.equal(classifySlskdTransferState(bound).code, 'failed'); assert.equal(hasProgressedDownloadEvidence(bound), false);
  assert.ok(bound.bytesTransferred > 0 && bound.bytesTransferred < file.size);
  assert.ok(typeof bound.exception === 'string' && bound.exception.length > 0);
  const raw = await readNativePartialApi(config, 'transfers/downloads/' + encodeURIComponent(nativePeer) + '/' + encodeURIComponent(row.id));
  assert.equal(raw.attempts, plan.maxAttempts);
  if (lost) {
    assert.ok(bound.exception.includes('remote size of ' + (file.size + 1)));
    assert.ok(bound.exception.includes('expected size ' + file.size));
  }
  for (const change of [{ id: randomUUID() }, { batchId: randomUUID() }, { size: file.size + 1 }, { filename: 'Other.bin' }, { username: 'other-peer' }]) {
    assert.equal(await service.getBoundDownload({ ...request, ...change }), null);
  }
  const recovery = await createSlskdDownloadHandoffReconciliationService({ getDownloadBatchEvidence: service.getDownloadBatchEvidence })
    .findMatchingTransfers({ attempt, ...attempt });
  assert.equal(recovery.disposition, 'unknown'); assert.equal(recovery.allRequestedFilesMatched, false);
  assert.equal(posts, 1); assert.equal(postStatus, 201); assert.equal(beforeSend, 1); assert.deepEqual(attempt, original);
  return { kind: plan.kind, filename: file.filename, size: file.size, bytesTransferred: bound.bytesTransferred, state: bound.state,
    nativeAttempts: raw.attempts, observedStates: [...observedStates], receiptIdentityStable: true, exceptionPresent: true,
    sizeMismatchVerified: lost, classification: 'failed', recoveryDisposition: recovery.disposition, lostResponse: lost, posts, postStatus, beforeSend };
}
