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
import { waitForNativePartialState } from './native-partial-api.js';

export async function runNativePartialBatch({ plan, config, expectedVersion }) {
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
  const original = structuredClone(attempt);
  const submit = () => dispatch.enqueue({ attempt, beforeSend: async () => { beforeSend += 1; } });
  if (lost) await assert.rejects(submit(), { code: 'slskd_unavailable' });
  else assert.equal(evaluateDownloadReceipt({ attempt, enqueueResult: await submit() }).disposition, 'confirmed');
  assert.equal(posts, 1); assert.equal(postStatus, 201); assert.equal(beforeSend, 1); assert.deepEqual(attempt, original);
  const batch = await waitForNativePartialState(() => service.getDownloadBatchEvidence({ attempt }), value =>
    value.transfers?.length === 1 && classifySlskdTransferState(value.transfers[0]).terminal && value.transfers[0].bytesTransferred > 0);
  assert.equal(batch.id, attempt.attemptId); assert.equal(batch.username, nativePeer);
  const row = batch.transfers[0];
  assert.equal(row.filename, plan.file.filename); assert.equal(row.size, plan.file.size); assert.equal(row.batchId, attempt.attemptId);
  const request = { id: row.id, username: nativePeer, filename: plan.file.filename, size: plan.file.size,
    batchId: attempt.attemptId, providerBinding: dispatch.binding };
  const transfer = await service.getBoundDownload(request);
  assert.ok(transfer); assert.equal(transfer.id, row.id); assert.equal(transfer.batchId, attempt.attemptId);
  const classification = classifySlskdTransferState(transfer);
  assert.equal(classification.code, plan.kind === 'complete' ? 'succeeded' : 'failed');
  assert.equal(classification.terminal, true);
  if (plan.kind === 'complete') {
    assert.equal(transfer.bytesTransferred, plan.file.size); assert.equal(transfer.exception, null);
  } else {
    assert.ok(transfer.bytesTransferred > 0 && transfer.bytesTransferred < plan.file.size);
    assert.ok(typeof transfer.exception === 'string' && transfer.exception.length > 0);
    assert.equal(hasProgressedDownloadEvidence(transfer), false);
  }
  const recovery = await createSlskdDownloadHandoffReconciliationService({ getDownloadBatchEvidence: service.getDownloadBatchEvidence })
    .findMatchingTransfers({ attempt, ...attempt });
  if (plan.kind === 'complete') assert.equal(recovery.disposition, 'confirmed');
  else { assert.notEqual(recovery.disposition, 'confirmed'); assert.equal(recovery.allRequestedFilesMatched, false); }
  for (const change of [{ filename: 'Other.bin' }, { size: plan.file.size + 1 }, { id: randomUUID() }, { batchId: randomUUID() }]) {
    assert.equal(await service.getBoundDownload({ ...request, ...change }), null);
  }
  assert.equal(posts, 1);
  return { kind: plan.kind, lostResponse: lost, posts, postStatus, beforeSend, filename: transfer.filename, size: transfer.size,
    bytesTransferred: transfer.bytesTransferred, state: transfer.state, classification: classification.code,
    exceptionPresent: Boolean(transfer.exception), recoveryDisposition: recovery.disposition, exactIdentityVerified: true };
}
