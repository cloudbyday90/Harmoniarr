import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import test from 'node:test';
import { buildImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { createDownloadAttempt } from '../../src/server/slskd/slskd-download-attempt-policy.js';
import { createImportCandidateDownloadOriginService } from '../../src/server/import-candidates/import-candidate-download-origin-service.js';
import { resolveDownloadOriginEpisode, normalizeDownloadOriginCommand } from '../../src/server/import-candidates/import-candidate-download-origin-policy.js';

function harness(overrides = {}) {
  const fixture = buildImportCandidateFixture({ candidateOverrides: { id: randomUUID(), status: 'selected' } });
  const candidate = { ...fixture.candidate, files: fixture.files.map((file) => ({ ...file, id: randomUUID() })) };
  const sourceRun = { id: randomUUID(), operationType: 'import_candidate_execution_planning', status: 'failed', summary: { triggerSource: 'manual' } };
  const binding = { protocol: 'batch', version: '0.26.0', endpointFingerprint: 'b'.repeat(64) };
  const requestedFiles = candidate.files.map((file) => ({ filename: file.rawPayload.filename, size: file.sizeBytes }));
  const attempt = createDownloadAttempt({ importCandidateId: candidate.id, operationRunId: sourceRun.id,
    requestedFiles, username: candidate.username, sourceObservation: captureRecoveryObservation(candidate), providerBinding: binding });
  const sourceItem = { id: randomUUID(), importCandidateId: candidate.id, operationRunId: sourceRun.id,
    itemStatus: 'awaiting_confirmation', planningSnapshot: { execution: { requestedFiles, handoff: { state: 'dispatching', attempt } } } };
  const newerRun = { id: randomUUID(), operationType: sourceRun.operationType, status: 'pending', attemptCount: 0,
    claimedAt: null, claimedByInstanceId: null, summary: { selectedCandidateId: candidate.id, requestedCandidateCount: 1,
      executionMode: 'download_enqueue', triggerSource: 'manual' } };
  const context = { candidate, sourceRun, sourceItem, newerRun, newerItems: [], newerLeases: [], sourceLeases: [],
    newerCount: 1, newerTransferLinkCount: 0, currentOriginId: newerRun.id, savedResolution: null };
  const actor = { id: randomUUID(), role: 'admin', isDisabled: false, mustChangePassword: false, sessionRevoked: false,
    sessionReplaced: false, sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(), qualityPreferences: {} };
  const owner = { operationRunId: sourceRun.id, importCandidateId: candidate.id, actorUserId: actor.id, refreshTokenId: randomUUID() };
  const batch = { id: attempt.attemptId, username: candidate.username, direction: 'Download', transfers: requestedFiles.map((file) => ({
    ...file, id: randomUUID(), batchId: attempt.attemptId, username: candidate.username, direction: 'Download', state: 'InProgress' })) };
  const state = { context, actor, batch, binding, tx: false, calls: [], reads: 0, policyAllowed: true };
  const copy = (value) => structuredClone(value);
  const store = { getActor: async () => copy(state.actor), getReviewContext: async () => copy(state.context),
    lockContext: async () => { assert.equal(state.tx, true); state.calls.push('lock'); return copy(state.context); },
    readParticipantPolicies: async () => [], lockParticipantReleases: async () => {}, getDiscovery: async () => null,
    findActiveSelection: async () => null,
    retireUnusedAllocation: async ({ resolutionId, requestHash, actorUserId, publicOutcome, queryable }) => {
      assert.equal(state.tx, true); assert.ok(queryable); state.calls.push('retire');
      const record = { version: 1, resolutionId, importCandidateId: owner.importCandidateId, sourceRunId: owner.operationRunId,
        newerRunId: newerRun.id, sourceAttemptId: attempt.attemptId, requestHash, actorUserId,
        resolvedAt: new Date().toISOString(), publicOutcome };
      state.context.sourceItem.planningSnapshot.execution.handoff.originResolution = copy(record);
      state.context.newerRun.summary.downloadOriginSupersession = copy(record); state.context.newerRun.status = 'cancelled';
      state.context.currentOriginId = sourceRun.id; state.context.savedResolution = copy(record); return record;
    }, ...overrides.store };
  const service = createImportCandidateDownloadOriginService({ store,
    prepareDownloadDispatch: async () => { assert.equal(state.tx, false); const pinnedBinding = copy(state.binding);
      return { binding: pinnedBinding, assertCurrent: async ({ queryable } = {}) => {
        if (state.tx) assert.ok(queryable, 'the final local check uses its owning transaction');
        if (!isDeepStrictEqual(pinnedBinding, state.binding)) {
        throw Object.assign(new Error('Provider changed'), { status: 503, code: 'slskd_download_provider_changed' });
      } } }; },
    getDownloadBatchEvidence: async () => { assert.equal(state.tx, false); state.reads += 1;
      await overrides.afterEvidence?.(state); return copy(state.batch); },
    confirmDownloadHandoff: async ({ providerEvidence, expectedAttempt, queryable }) => {
      assert.equal(state.tx, true); assert.ok(queryable); assert.equal(providerEvidence.id, expectedAttempt.attemptId);
      state.calls.push('confirm'); state.context.candidate.status = 'downloading'; return { confirmed: true };
    }, assertMaintenanceWriteAllowed: async () => { state.calls.push('maintenance'); },
    withTransaction: async (write) => { state.tx = true; try { return await write({}); } finally { state.tx = false; } },
    lockAccounts: async () => { state.calls.push('accounts'); }, recordAuditEventFn: async () => { assert.equal(state.tx, true); state.calls.push('audit'); },
    qualityPolicyService: { evaluateQualityEvidence: () => ({ autoDownloadEligible: state.policyAllowed }) },
    ...overrides.dependencies });
  return { service, state, owner };
}

async function reviewed(h) {
  const { downloadOriginReview } = await h.service.getDownloadOriginReview(h.owner);
  assert.equal(downloadOriginReview.canRestore, true);
  return { reviewDigest: downloadOriginReview.reviewDigest };
}

test('exact batch review and resolution use one transaction, preserve original intent and replay without provider reads', async () => {
  const h = harness(); const command = await reviewed(h); const original = structuredClone(h.state.context.sourceItem.planningSnapshot.execution.handoff.attempt);
  const result = await h.service.resolveDownloadOrigin({ ...h.owner, command });
  assert.equal(result.downloadOriginResolution.outcome, 'restored'); assert.equal(result.downloadOriginResolution.retiredRequestCount, 1);
  assert.deepEqual(h.state.calls, ['maintenance', 'accounts', 'lock', 'retire', 'confirm', 'audit']);
  assert.deepEqual(h.state.context.sourceItem.planningSnapshot.execution.handoff.attempt, original);
  const reads = h.state.reads;
  assert.equal((await h.service.resolveDownloadOrigin({ ...h.owner, command })).downloadOriginResolution.replayed, true);
  assert.equal(h.state.reads, reads); assert.equal(h.state.calls.filter((call) => call === 'audit').length, 1);
});

for (const [label, change] of [
  ['active newer job', (c) => { c.newerRun.status = 'running'; }],
  ['a claim acquired after allocation', (c) => { c.newerRun.claimedAt = new Date().toISOString(); }],
  ['previously attempted job with no dispatch checkpoint', (c) => { c.newerRun.attemptCount = 1; }],
  ['multiple newer origins', (c) => { c.newerCount = 2; }],
  ['foreign newer transfer link', (c) => { c.newerTransferLinkCount = 1; }],
  ['unknown source lease facts', (c) => { c.sourceLeases = null; }],
  ['physical file size drift', (c) => { c.candidate.files[0].sizeBytes += 1; }],
  ['legacy uncertain source', (c) => { const a = c.sourceItem.planningSnapshot.execution.handoff.attempt; a.version = 1; delete a.providerBinding; }],
  ['adopted source', (c) => { c.sourceItem.planningSnapshot.execution.handoff.adoption = {}; }],
]) {
  test(`origin policy refuses ${label} without reading provider or mutating`, async () => {
    const h = harness(); change(h.state.context);
    assert.equal(resolveDownloadOriginEpisode(h.state.context).eligible, false);
    assert.equal((await h.service.getDownloadOriginReview(h.owner)).downloadOriginReview.canRestore, false);
    assert.equal(h.state.reads, 0); assert.deepEqual(h.state.calls, []);
  });
}

test('request cannot forge newer IDs or introduce another command intent', () => {
  assert.deepEqual(normalizeDownloadOriginCommand({ reviewDigest: 'A'.repeat(64) }), { reviewDigest: 'a'.repeat(64) });
  for (const command of [null, [], {}, { reviewDigest: 'wrong' }, { reviewDigest: 'a'.repeat(64), newerRunId: randomUUID() },
    { reviewDigest: 'a'.repeat(64), transferIds: [randomUUID()] }]) {
    assert.throws(() => normalizeDownloadOriginCommand(command), { code: 'validation_error' });
  }
});

for (const [label, change] of [
  ['local-only queue', (s) => { s.batch.transfers[0].state = 'Queued, Locally'; }],
  ['incomplete manifest', (s) => { s.batch.transfers.pop(); }],
  ['foreign batch', (s) => { s.batch.id = randomUUID(); }],
  ['provider binding drift', (s) => { s.binding.endpointFingerprint = 'c'.repeat(64); }],
]) {
  test(`fresh provider ${label} cannot authorize restoration`, async () => {
    const h = harness(); const command = await reviewed(h); change(h.state);
    await assert.rejects(h.service.resolveDownloadOrigin({ ...h.owner, command }), (error) => error.status === 409);
    assert.equal(h.state.calls.includes('retire'), false);
  });
}

test('revoked actor after provider preparation refuses before retirement', async () => {
  const h = harness({ afterEvidence: (state) => { if (state.reads > 1) state.actor.role = 'operator'; } });
  const command = await reviewed(h);
  await assert.rejects(h.service.resolveDownloadOrigin({ ...h.owner, command }), { code: 'admin_required' });
  assert.equal(h.state.calls.includes('retire'), false);
});

test('newer allocation or strict policy changed during provider preparation invalidates the reviewed intent', async () => {
  for (const change of [(state) => { state.context.newerCount = 2; }, (state) => { state.policyAllowed = false; }]) {
    const h = harness({ afterEvidence: (state) => { if (state.reads > 1) change(state); } }); const command = await reviewed(h);
    await assert.rejects(h.service.resolveDownloadOrigin({ ...h.owner, command }), { code: 'import_execution_download_origin_not_current' });
    assert.equal(h.state.calls.includes('retire'), false);
  }
});

test('stale digest and a different actor cannot replace an existing resolution', async () => {
  const h = harness(); const command = await reviewed(h);
  await assert.rejects(h.service.resolveDownloadOrigin({ ...h.owner, command: { reviewDigest: 'f'.repeat(64) } }), { code: 'import_execution_download_origin_not_current' });
  await h.service.resolveDownloadOrigin({ ...h.owner, command });
  h.state.actor.id = randomUUID();
  await assert.rejects(h.service.resolveDownloadOrigin({ ...h.owner, actorUserId: h.state.actor.id, command }), { code: 'import_execution_download_origin_not_current' });
  assert.equal(h.state.calls.filter((call) => call === 'retire').length, 1);
});

test('an invalid reciprocal record refuses saved success', async () => {
  const h = harness(); const command = await reviewed(h); await h.service.resolveDownloadOrigin({ ...h.owner, command });
  delete h.state.context.newerRun.summary.downloadOriginSupersession;
  await assert.rejects(h.service.resolveDownloadOrigin({ ...h.owner, command }), { code: 'import_execution_download_origin_not_current' });
});

test('provider binding changed after the batch read refuses before opening retirement', async () => {
  const h = harness({ afterEvidence: (state) => { if (state.reads > 1) state.binding.endpointFingerprint = 'c'.repeat(64); } });
  const command = await reviewed(h);
  await assert.rejects(h.service.resolveDownloadOrigin({ ...h.owner, command }), { code: 'slskd_download_provider_changed' });
  assert.equal(h.state.calls.includes('retire'), false);
});

test('provider binding changed during locked preparation refuses before retirement', async () => {
  let h;
  h = harness({ dependencies: { lockAccounts: async () => { h.state.binding.endpointFingerprint = 'c'.repeat(64); } } });
  const command = await reviewed(h);
  await assert.rejects(h.service.resolveDownloadOrigin({ ...h.owner, command }), { code: 'slskd_download_provider_changed' });
  assert.equal(h.state.calls.includes('retire'), false);
});
