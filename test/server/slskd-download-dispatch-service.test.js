import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createSlskdService } from '../../src/server/slskd/slskd-service.js';
import { createSlskdClient } from '../../src/server/integrations/slskd/slskd-client.js';
import { createDownloadAttempt, evaluateDownloadReceipt } from '../../src/server/slskd/slskd-download-attempt-policy.js';
import { createSlskdDownloadHandoffReconciliationService } from '../../src/server/slskd/slskd-download-handoff-reconciliation-service.js';
import { createSlskdTransferSnapshotService } from '../../src/server/slskd/slskd-transfer-snapshot-service.js';

function harness({ version = '0.26.0', respond = null } = {}) {
  const config = { baseUrl: 'http://localhost:5030', apiKey: 'test-key', providerMode: 'external' };
  const calls = [];
  const fetchImpl = async (url, request) => {
    const call = { url: new URL(url), request, body: request.body ? JSON.parse(request.body) : null };
    calls.push(call);
    if (respond) {
      const value = await respond(call, config);
      if (value !== undefined) return value;
    }
    if (call.url.pathname.endsWith('/application/version')) return Response.json(version);
    throw new Error(`Unconfigured fixture path ${call.url.pathname}`);
  };
  const service = createSlskdService({ getClientConfig: async () => ({ ...config }),
    createSlskdClientFn: (options) => createSlskdClient({ ...options, fetchImpl }) });
  const attempt = (binding) => createDownloadAttempt({ providerBinding: binding, operationRunId: 'run', importCandidateId: 'candidate',
    username: 'peer', sourceObservation: { username: 'peer' }, requestedFiles: [{ filename: 'Album/01.flac', size: 1000 }] });
  return { service, config, calls, attempt };
}

function transfer(attempt, overrides = {}) {
  return { ...attempt.requestedFiles[0], id: randomUUID(), username: attempt.username, direction: 'Download',
    state: 'InProgress', removed: false, batchId: attempt.attemptId, ...overrides };
}

test('the actual client probes version then posts the saved UUID/manifest with no invented header or placement options', async () => {
  const h = harness({ respond: async (call) => {
    if (call.request.method === 'POST') return Response.json({ batch: { id: call.body.id, username: call.body.username, direction: 'Download',
      transfers: call.body.files.map((file) => ({ ...file, id: randomUUID(), batchId: call.body.id, username: call.body.username,
        direction: 'Download', state: 'Queued, Locally', removed: false })) }, failures: [] }, { status: 201 });
  } });
  const dispatch = await h.service.prepareDownloadDispatch();
  const saved = h.attempt(dispatch.binding);
  const result = await dispatch.enqueue({ attempt: saved });
  assert.equal(result.enqueued.length, 1);
  const post = h.calls.find((call) => call.request.method === 'POST');
  assert.equal(post.url.pathname, '/api/v0/transfers/downloads/batches');
  assert.deepEqual(post.body, { id: saved.attemptId, username: 'peer', files: saved.requestedFiles });
  assert.equal(post.request.headers['X-API-Key'], 'test-key');
  assert.equal(Object.hasOwn(post.request.headers, 'Idempotency-Key'), false);
  assert.equal(JSON.stringify(saved).includes('test-key'), false);
});

test('verified legacy selection retains the existing direct endpoint and receipt normalization', async () => {
  const h = harness({ version: '0.25.1', respond: async (call) => {
    if (call.request.method === 'POST') return Response.json({ Enqueued: call.body.map((file) => ({ ...file, id: randomUUID(), username: 'peer', direction: 'Download' })), Failed: [] }, { status: 201 });
  } });
  const dispatch = await h.service.prepareDownloadDispatch();
  assert.equal(dispatch.binding.protocol, 'legacy');
  const result = await dispatch.enqueue({ attempt: h.attempt(dispatch.binding) });
  assert.equal(result.enqueued.length, 1);
  assert.equal(h.calls.at(-1).url.pathname, '/api/v0/transfers/downloads/peer');
});

test('future and malformed provider versions refuse before any POST', async () => {
  for (const version of ['0.26.1', '0.27.0', '0.26.0-dev', null, { version: '0.26.0' }]) {
    const h = harness({ version });
    await assert.rejects(h.service.prepareDownloadDispatch(), { code: 'slskd_download_version_unsupported' });
    assert.equal(h.calls.some((call) => call.request.method === 'POST'), false);
  }
});

test('endpoint changes during the awaited version probe cannot bind an old client to the new endpoint', async () => {
  const h = harness({ respond: async (call, config) => {
    if (call.url.pathname.endsWith('/application/version')) { config.baseUrl = 'http://localhost:5040'; return Response.json('0.26.0'); }
  } });
  await assert.rejects(h.service.prepareDownloadDispatch(), { code: 'slskd_download_provider_changed' });
  assert.equal(h.calls.length, 1);
});

for (const field of ['baseUrl', 'apiKey', 'enabled']) {
  test(`changing ${field} after preparation refuses the saved POST without fallback`, async () => {
    const h = harness();
    const dispatch = await h.service.prepareDownloadDispatch();
    const saved = h.attempt(dispatch.binding);
    h.config[field] = field === 'baseUrl' ? 'http://localhost:5040' : field === 'apiKey' ? 'rotated-test-key' : false;
    await assert.rejects(dispatch.enqueue({ attempt: saved }));
    assert.equal(h.calls.some((call) => call.request.method === 'POST'), false);
  });
}

test('409 is uncertainty; it never invokes a legacy POST or fabricates all-file rejection', async () => {
  const h = harness({ respond: async (call) => call.request.method === 'POST' ? Response.json({}, { status: 409 }) : undefined });
  const dispatch = await h.service.prepareDownloadDispatch();
  const result = await dispatch.enqueue({ attempt: h.attempt(dispatch.binding) });
  assert.equal(result.batchConflict, true);
  assert.deepEqual(result.failed, []);
  assert.equal(h.calls.filter((call) => call.request.method === 'POST').length, 1);
  assert.equal(h.calls.at(-1).url.pathname, '/api/v0/transfers/downloads/batches');
});

test('lost-response reconciliation uses exact bound GET and returns private evidence for transactional revalidation', async () => {
  let saved;
  const h = harness({ respond: async (call) => {
    if (saved && call.url.pathname.endsWith(`/batches/${saved.attemptId}`)) return Response.json({ id: saved.attemptId,
      username: saved.username, direction: 'Download', transfers: [transfer(saved)] });
  } });
  const dispatch = await h.service.prepareDownloadDispatch();
  saved = h.attempt(dispatch.binding);
  const reconciler = createSlskdDownloadHandoffReconciliationService({ getDownloadBatchEvidence: h.service.getDownloadBatchEvidence });
  const proof = await reconciler.findMatchingTransfers({ attempt: saved, ...saved });
  assert.equal(proof.disposition, 'confirmed');
  assert.equal(proof.providerEvidence.id, saved.attemptId);
  assert.equal(h.calls.some((call) => call.request.method === 'POST'), false);
  h.config.baseUrl = 'http://localhost:5040';
  await assert.rejects(reconciler.findMatchingTransfers({ attempt: saved, ...saved }), { code: 'slskd_download_provider_changed' });
});

test('exact detail reads retain removed success, reject identity/state corruption and report absence as pending', async () => {
  let row;
  let responseStatus = 200;
  const h = harness({ respond: async (call) => call.url.pathname.includes('/transfers/downloads/peer/')
    ? Response.json(responseStatus === 200 ? row : {}, { status: responseStatus }) : undefined });
  const dispatch = await h.service.prepareDownloadDispatch();
  const saved = h.attempt(dispatch.binding);
  row = transfer(saved, { state: 'Completed, Succeeded', removed: true });
  const request = { ...row, providerBinding: dispatch.binding };
  const snapshots = createSlskdTransferSnapshotService({ getBoundDownloads: h.service.getBoundDownloads,
    getDownloads: async () => { throw new Error('History fallback must not run'); } });
  let snapshot = await snapshots.buildTransferSnapshot({ requestedTransfers: [request, request] });
  assert.equal(snapshot.getTransfer(request).removed, true);
  assert.equal(snapshot.isObservationPending(request), false);
  assert.equal(snapshot.getTransfer({ ...request, providerBinding: { ...request.providerBinding, endpointFingerprint: 'b'.repeat(64) } }), null);
  for (const change of [{ username: 'other' }, { direction: 'Upload' }, { id: randomUUID() },
    { state: 'NotCompleted, NotSucceeded' }, { size: 0 }, { size: row.size + 1 }, { filename: 'Other.flac' }, { batchId: randomUUID() }]) {
    const original = row;
    row = { ...row, ...change };
    snapshot = await snapshots.buildTransferSnapshot({ requestedTransfers: [request] });
    assert.equal(snapshot.getTransfer(request), null);
    assert.equal(snapshot.isObservationPending(request), true);
    row = original;
  }
  responseStatus = 404;
  snapshot = await snapshots.buildTransferSnapshot({ requestedTransfers: [request] });
  assert.equal(snapshot.isObservationPending(request), true);
});

test('exact receipt reads deduplicate identities and bound concurrent provider requests', async () => {
  let active = 0;
  let maximumActive = 0;
  const rows = Array.from({ length: 24 }, (_, index) => ({ id: randomUUID(), username: 'peer', direction: 'Download',
    filename: `Album\\${index}.flac`, size: 1000, state: 'InProgress', removed: false }));
  const h = harness({ respond: async (call) => {
    const row = rows.find((value) => call.url.pathname.endsWith(`/${value.id}`));
    if (!row) return undefined;
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => { setImmediate(resolve); });
    active -= 1;
    return Response.json(row);
  } });
  const snapshot = await h.service.getBoundDownloads({ requestedTransfers: [...rows, ...rows] });
  assert.equal(snapshot.transfers.length, 24);
  assert.equal(h.calls.length, 24);
  assert.equal(maximumActive, 8);
});

test('whole operator selection uses strict list plus exact reads and refuses a competing record', async () => {
  let row;
  let competing = null;
  const h = harness({ version: '0.25.1', respond: async (call) => {
    if (call.url.pathname.endsWith('/downloads/peer')) return Response.json({ username: 'peer', directories: [{ files: competing ? [row, competing] : [row] }] });
    if (call.url.pathname.includes('/downloads/peer/')) return Response.json(row);
  } });
  const dispatch = await h.service.prepareDownloadDispatch();
  const saved = h.attempt(dispatch.binding);
  row = transfer(saved);
  const input = { username: 'peer', requestedFiles: saved.requestedFiles, transferIds: [row.id], providerBinding: dispatch.binding };
  const proof = await h.service.validateSelectedAdoptionTransfers(input);
  assert.equal(proof.source, 'operator_adoption');
  competing = { ...row, id: randomUUID() };
  await assert.rejects(h.service.validateSelectedAdoptionTransfers(input), { code: 'import_execution_download_adoption_evidence_not_current' });
  assert.equal(h.calls.some((call) => ['POST', 'DELETE'].includes(call.request.method)), false);
});

test('malformed or truncated exact-ID response bodies remain per-receipt pending', async () => {
  let fixtureResponse;
  const h = harness({ respond: async (call) => call.url.pathname.includes('/downloads/peer/') ? fixtureResponse() : undefined });
  const dispatch = await h.service.prepareDownloadDispatch();
  const saved = h.attempt(dispatch.binding);
  const request = { ...transfer(saved), providerBinding: dispatch.binding };
  for (const response of [() => new Response('{invalid', { status: 200 }),
    () => ({ ok: true, status: 200, text: async () => { throw new Error('Controlled truncated body'); } })]) {
    fixtureResponse = response;
    const snapshot = await h.service.getBoundDownloads({ requestedTransfers: [request] });
    assert.deepEqual(snapshot.transfers, []);
    assert.equal(snapshot.observations[0].issue, 'provider_unavailable');
  }
});

test('malformed batch lookup is a typed uncertainty and cannot send another POST', async () => {
  const h = harness({ respond: async (call) => call.url.pathname.includes('/downloads/batches/') ? new Response('{invalid', { status: 200 }) : undefined });
  const dispatch = await h.service.prepareDownloadDispatch();
  const saved = h.attempt(dispatch.binding);
  const reconciler = createSlskdDownloadHandoffReconciliationService({ getDownloadBatchEvidence: h.service.getDownloadBatchEvidence });
  await assert.rejects(reconciler.findMatchingTransfers({ attempt: saved, ...saved }), { code: 'slskd_unavailable' });
  assert.equal(h.calls.some((call) => call.request.method === 'POST'), false);
});

test('a durable exact batch rejection is preserved during resume without replacing it with a lookup guess', async () => {
  const h = harness();
  const dispatch = await h.service.prepareDownloadDispatch();
  const initial = h.attempt(dispatch.binding);
  const { attempt } = evaluateDownloadReceipt({ attempt: initial, enqueueResult: { enqueued: [], failed: initial.requestedFiles.map((file) => file.filename) } });
  let reads = 0;
  const reconciler = createSlskdDownloadHandoffReconciliationService({ getDownloadBatchEvidence: async () => { reads += 1; return {}; } });
  const proof = await reconciler.findMatchingTransfers({ attempt, ...attempt });
  assert.equal(proof.disposition, 'rejected');
  assert.equal(reads, 0);
  assert.deepEqual(proof.attempt.failedFiles, initial.requestedFiles.map((file) => file.filename));
});
