/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { createSlskdService } from '../../src/server/slskd/slskd-service.js';
import { createSlskdClient } from '../../src/server/integrations/slskd/slskd-client.js';
import { createDownloadAttempt, evaluateDownloadReceipt } from '../../src/server/slskd/slskd-download-attempt-policy.js';
import { createSlskdDownloadHandoffReconciliationService } from '../../src/server/slskd/slskd-download-handoff-reconciliation-service.js';
import { nativeFiles, nativePeer } from './fixture-data.js';

const { apiKey } = JSON.parse(await readFile('/run/fixture.json', 'utf8'));
const config = { baseUrl: 'http://provider:5030', apiKey, requestTimeoutMs: 2000 };
async function eventually(read, accepted) {
  const deadline = performance.now() + 15_000;
  let last;
  do {
    try { last = await read(); if (accepted(last)) return last; } catch { /* Startup and native queue transitions are asynchronous. */ }
    await delay(100);
  } while (performance.now() < deadline);
  throw new Error('Native provider did not reach the required state');
}
await eventually(async () => {
  const response = await fetch(config.baseUrl + '/api/v0/server', {
    headers: { 'X-API-Key': apiKey }, signal: AbortSignal.timeout(2000),
  });
  assert.equal(response.status, 200);
  return response.json();
}, state => state.isLoggedIn === true);

const scenarios = [];
for (const lost of [false, true]) {
  let posts = 0; let postStatus; let beforeSend = 0;
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
  const dispatch = await service.prepareDownloadDispatch();
  assert.equal(dispatch.binding.version, '0.26.0.0');
  const files = nativeFiles.slice(lost ? 2 : 0, lost ? 4 : 2);
  const attempt = createDownloadAttempt({ providerBinding: dispatch.binding, importCandidateId: randomUUID(),
    operationRunId: randomUUID(), username: nativePeer, requestedFiles: files, sourceObservation: { username: nativePeer } });
  const original = structuredClone(attempt);
  const submit = () => dispatch.enqueue({ attempt, beforeSend: async () => { beforeSend += 1; } });
  let direct;
  if (lost) await assert.rejects(submit(), { code: 'slskd_unavailable' });
  else {
    direct = evaluateDownloadReceipt({ attempt, enqueueResult: await submit() });
    assert.equal(direct.disposition, 'confirmed');
    assert.equal(direct.attempt.receipts.length, 2);
  }
  assert.equal(posts, 1); assert.equal(postStatus, 201); assert.equal(beforeSend, 1);
  assert.deepEqual(attempt, original);
  const batch = await eventually(() => service.getDownloadBatchEvidence({ attempt }),
    value => value.transfers?.length === 2 && value.transfers.every(row => row.state === 'Queued, Remotely'));
  assert.equal(batch.id, attempt.attemptId);
  const reconciliation = createSlskdDownloadHandoffReconciliationService({ getDownloadBatchEvidence: service.getDownloadBatchEvidence });
  const proof = await reconciliation.findMatchingTransfers({ attempt, ...attempt });
  assert.equal(proof.disposition, 'confirmed');
  assert.equal(proof.attempt.receipts.length, 2);
  if (direct) {
    const identities = rows => rows.map(({ id, filename, size, username, batchId }) => ({ id, filename, size, username, batchId }))
      .sort((left, right) => left.filename.localeCompare(right.filename));
    assert.deepEqual(identities(proof.attempt.receipts), identities(direct.attempt.receipts));
  }
  const receipts = proof.attempt.receipts;
  assert.equal(new Set(receipts.map(row => row.id)).size, 2);
  for (const receipt of receipts) {
    const request = { ...receipt, providerBinding: dispatch.binding };
    const transfer = await service.getBoundDownload(request);
    assert.equal(transfer.id, receipt.id);
    assert.equal(transfer.batchId, attempt.attemptId);
    assert.equal(transfer.state, 'Queued, Remotely');
    assert.equal(transfer.bytesTransferred, 0);
    for (const change of [{ filename: 'Other.flac' }, { size: receipt.size + 1 },
      { batchId: randomUUID() }, { id: randomUUID() }, { username: 'unowned-peer' }]) {
      assert.equal(await service.getBoundDownload({ ...request, ...change }), null);
    }
  }
  assert.equal(posts, 1);
  scenarios.push({ lostResponse: lost, postStatus, posts, beforeSend, receipts: receipts.length, exactReadsVerified: true,
    state: 'Queued, Remotely', bytesTransferred: 0, rawVersion: dispatch.binding.version });
}
console.log(JSON.stringify({ complete: true, scenarios }));
