import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { buildImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { createImportCandidateDownloadAdoptionService } from '../../src/server/import-candidates/import-candidate-download-adoption-service.js';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';

function harness(overrides = {}) {
  const built = buildImportCandidateFixture({ candidateOverrides: { id: randomUUID(), status: 'selected' } });
  const candidate = { ...built.candidate, files: built.files.map((file) => ({ ...file, id: randomUUID() })) };
  const run = { id: randomUUID(), operationType: 'import_candidate_execution_planning', status: 'failed', summary: { triggerSource: 'manual' } };
  const source = captureRecoveryObservation(candidate);
  const requestedFiles = candidate.files.map((file) => ({ filename: file.rawPayload.filename, size: file.sizeBytes }));
  const item = { id: randomUUID(), operationRunId: run.id, importCandidateId: candidate.id, itemStatus: 'awaiting_confirmation',
    planningSnapshot: { execution: { sourceObservation: source, requestedFiles, handoff: { state: 'dispatching' } } } };
  const currentActor = { id: randomUUID(), role: 'admin', isDisabled: false, mustChangePassword: false, sessionRevoked: false,
    sessionReplaced: false, sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(), qualityPreferences: {} };
  const owner = { operationRunId: run.id, importCandidateId: candidate.id, actorUserId: currentActor.id, refreshTokenId: randomUUID() };
  const binding = { protocol: 'legacy', version: '0.25.1', endpointFingerprint: 'b'.repeat(64) };
  const transfers = requestedFiles.map((file) => ({ ...file, id: randomUUID(), username: candidate.username, direction: 'Download', state: 'InProgress' }));
  const state = { candidate, item, run, currentOriginId: run.id, actor: currentActor, binding, transfers, effects: 0, tx: false, calls: [] };
  const copy = (value) => structuredClone(value);
  const store = {
    getActor: async () => copy(state.actor),
    getEpisode: async () => copy({ candidate: state.candidate, item: state.item, run: state.run, currentOriginId: state.currentOriginId }),
    lockEpisode: async () => { state.calls.push('candidate-item-lock'); return store.getEpisode(); },
    readParticipantPolicies: async () => [], lockParticipantReleases: async () => {}, getDiscovery: async () => null,
    findActiveSelection: async () => null,
    hasForeignBatchAttempt: async () => false,
    ...overrides.store,
  };
  const service = createImportCandidateDownloadAdoptionService({ store,
    assertMaintenanceWriteAllowed: async () => { state.calls.push('maintenance'); },
    lockAccounts: async () => { state.calls.push('accounts-lock'); },
    withTransaction: async (runTransaction) => { state.calls.push('tx-start'); state.tx = true;
      try { return await runTransaction({ query: async () => ({ rows: [] }) }); } finally { state.tx = false; } },
    listAdoptionTransfers: async () => { assert.equal(state.tx, false); state.calls.push('provider-list'); return copy({ binding: state.binding, transfers: state.transfers }); },
    validateSelectedAdoptionTransfers: async ({ transferIds, providerBinding }) => {
      assert.equal(state.tx, false); state.calls.push('provider-details');
      assert.deepEqual(providerBinding, state.binding);
      if (transferIds.length !== state.transfers.length || state.transfers.some((row) => !transferIds.includes(row.id))) {
        throw Object.assign(new Error('Evidence changed'), { status: 409, code: 'import_execution_download_adoption_evidence_not_current' });
      }
      await overrides.afterEvidence?.(state);
      return copy({ binding: state.binding, receipts: state.transfers, source: 'operator_adoption', allRequestedFilesMatched: true, requestedFileCount: requestedFiles.length });
    },
    adoptDownloadHandoff: async (input) => {
      assert.equal(state.tx, true); assert.ok(input.queryable); state.effects += 1;
      state.item.planningSnapshot.execution.handoff.adoption = { requestHash: input.adoptionRequestHash,
        receipts: copy(input.selectedTransfers), outcome: input.publicOutcome };
      state.candidate.status = 'downloading';
      return { adopted: true, outcome: 'adopted_for_tracking' };
    },
    ...overrides.dependencies,
  });
  return { service, state, owner };
}

async function reviewed(h) {
  const result = await h.service.getDownloadAdoptionReview(h.owner);
  assert.equal(result.downloadAdoptionReview.canAdopt, true);
  return { reviewDigest: result.downloadAdoptionReview.reviewDigest,
    transferIds: result.downloadAdoptionReview.files.map((file) => file.choices[0].id) };
}

test('admin review is read-only, bounded, and omits provider peer/path/source evidence', async () => {
  const h = harness(); const before = structuredClone(h.state.item);
  const review = (await h.service.getDownloadAdoptionReview(h.owner)).downloadAdoptionReview;
  assert.equal(review.canAdopt, true); assert.equal(review.requestedFileCount, 1);
  assert.equal(review.files[0].label, '01 Foil.flac'); assert.equal(review.files[0].choices[0].stateLabel, 'Downloading');
  assert.doesNotMatch(JSON.stringify(review), /source-user|Autechre|endpointFingerprint|providerBinding|sourceObservation|requestedFiles/u);
  assert.deepEqual(h.state.item, before); assert.equal(h.state.effects, 0); assert.equal(h.state.calls.includes('tx-start'), false);
});

test('UUID case aliases use the same owning review and command identities', async () => {
  const h = harness(); const command = await reviewed(h);
  const upper = Object.fromEntries(Object.entries(h.owner).map(([key, value]) => [key, value.toUpperCase()]));
  const outcome = await h.service.adoptExistingDownloads({ ...upper, command });
  assert.equal(outcome.downloadAdoption.operationRunId, h.owner.operationRunId);
  assert.equal(outcome.downloadAdoption.importCandidateId, h.owner.importCandidateId);
  assert.equal(h.state.effects, 1);
});

test('fresh adoption delegates existing downloads in one transaction and durable replay performs no provider reads or extra effect', async () => {
  const h = harness(); const command = await reviewed(h); h.state.calls.length = 0;
  const original = structuredClone(h.state.item.planningSnapshot.execution.sourceObservation);
  const outcome = await h.service.adoptExistingDownloads({ ...h.owner, command });
  assert.equal(outcome.downloadAdoption.outcome, 'adopted'); assert.equal(outcome.downloadAdoption.adoptedFileCount, 1);
  assert.equal(h.state.effects, 1); assert.deepEqual(h.state.item.planningSnapshot.execution.sourceObservation, original);
  assert.equal(h.state.calls.indexOf('provider-details') < h.state.calls.indexOf('tx-start'), true);
  h.state.calls.length = 0;
  const replay = await h.service.adoptExistingDownloads({ ...h.owner, command });
  assert.equal(replay.downloadAdoption.replayed, true); assert.equal(h.state.effects, 1);
  assert.equal(h.state.calls.some((call) => call.startsWith('provider-')), false);
  await assert.rejects(h.service.adoptExistingDownloads({ ...h.owner, command: { ...command, reviewDigest: 'f'.repeat(64) } }), { code: 'import_execution_download_adoption_not_current' });
});

test('active, newer, malformed and missing immutable episodes cannot list provider history', async () => {
  for (const alter of [
    (x) => { x.run.status = 'running'; }, (x) => { x.currentOriginId = randomUUID(); },
    (x) => { delete x.item.planningSnapshot.execution.sourceObservation; },
    (x) => { x.candidate.normalizedPayload.musicQueue = null; },
    (x) => { x.candidate.normalizedPayload.requestOwnership = { sourceRequestedForUserId: randomUUID() }; },
  ]) {
    const h = harness(); alter(h.state); const review = await h.service.getDownloadAdoptionReview(h.owner);
    assert.equal(review.downloadAdoptionReview.canAdopt, false); assert.equal(h.state.calls.includes('provider-list'), false);
  }
});

test('actor loss after awaited evidence refuses review and mutation before adoption', async () => {
  const reviewing = harness({ afterEvidence: (state) => { state.actor.role = 'member'; } });
  await assert.rejects(reviewing.service.getDownloadAdoptionReview(reviewing.owner), { code: 'admin_required' });
  for (const change of [(x) => { x.actor.role = 'member'; }, (x) => { x.actor.isDisabled = true; },
    (x) => { x.actor.sessionRevoked = true; }, (x) => { x.actor.mustChangePassword = true; },
    (x) => { x.actor.sessionExpiresAt = 'invalid'; }]) {
    let applyChange = false;
    const h = harness({ afterEvidence: (state) => { if (applyChange) change(state); } });
    const command = await reviewed(h); applyChange = true;
    await assert.rejects(h.service.adoptExistingDownloads({ ...h.owner, command }), (error) => ['admin_required', 'reauth_required'].includes(error.code));
    assert.equal(h.state.effects, 0);
  }
});

test('source or latest-origin drift during provider inspection refuses current write while heartbeat-only changes do not invalidate the review', async () => {
  for (const change of [(x) => { x.candidate.folderPath = 'Changed'; }, (x) => { x.currentOriginId = randomUUID(); }]) {
    let applying = false; const h = harness({ afterEvidence: (state) => { if (applying) change(state); } });
    const command = await reviewed(h); applying = true;
    await assert.rejects(h.service.adoptExistingDownloads({ ...h.owner, command }), { code: 'import_execution_download_adoption_not_current' });
    assert.equal(h.state.effects, 0);
  }
  let applying = false; const h = harness({ afterEvidence: (state) => { if (applying) {
    state.item.updatedAt = new Date().toISOString(); state.candidate.updatedAt = new Date().toISOString();
    state.item.planningSnapshot.execution.latestTransferSnapshot = { unrelatedProgress: 42 };
  } } });
  const command = await reviewed(h); applying = true;
  assert.equal((await h.service.adoptExistingDownloads({ ...h.owner, command })).downloadAdoption.outcome, 'adopted');
});

test('changed digest, unreviewed IDs, competing file IDs and maintenance refusal cannot commit', async () => {
  for (const kind of ['digest', 'ids', 'competing', 'maintenance']) {
    const h = harness({ dependencies: kind === 'maintenance' ? { assertMaintenanceWriteAllowed: async () => {
      throw Object.assign(new Error('Maintenance'), { status: 409, code: 'maintenance_active' }); } } : {} });
    const command = await reviewed(h);
    if (kind === 'digest') command.reviewDigest = '0'.repeat(64);
    if (kind === 'ids') command.transferIds = [randomUUID()];
    if (kind === 'competing') h.state.transfers.push({ ...h.state.transfers[0], id: randomUUID() });
    await assert.rejects(h.service.adoptExistingDownloads({ ...h.owner, command })); assert.equal(h.state.effects, 0);
  }
});

test('a foreign saved batch attempt refuses explicit adoption before its later causal receipt can be stolen', async () => {
  const h = harness({ store: { hasForeignBatchAttempt: async () => true } });
  await assert.rejects(h.service.getDownloadAdoptionReview(h.owner), { code: 'import_execution_download_adoption_not_current' });
  assert.equal(h.state.effects, 0); assert.equal(h.state.calls.includes('tx-start'), false);
});

test('real shared quality reconstruction refuses revoked consent, stricter sibling floor and participant eligibility drift', async () => {
  for (const kind of ['consent', 'floor', 'disabled', 'unlinked', 'approval', 'membership']) {
    const primaryId = randomUUID(); const siblingId = randomUUID(); const metadataReleaseId = randomUUID();
    const participants = [primaryId, siblingId].map((wantedReleaseId) => ({ wantedReleaseId, appUserId: randomUUID(), metadataReleaseId,
      qualityPreferences: { minimumQuality: 'lossless', preferredFormat: 'flac' },
      qualityOverride: { mode: 'allow_fallback_quality', wantedReleaseId, minimumBitrateKbps: 256 },
      discoveryLinkExists: true, isDisabled: false, wantedStatus: 'missing', missingTrackCount: 1, visibilityState: 'visible' }));
    let applying = false;
    const h = harness({ store: {
      readParticipantPolicies: async () => structuredClone(participants),
      getDiscovery: async () => ({ searchMode: 'automatic', lastSearchAt: '2026-10-08T20:00:00Z',
        evidence: { lastSearchId: 'current-search', lastDispatchAttemptedAt: '2026-10-08T20:00:00Z', lastSearchResult: { observedAt: '2026-10-08T20:01:00Z' } } }),
    }, afterEvidence: () => { if (!applying) return;
      if (kind === 'consent') participants[1].qualityOverride = null;
      if (kind === 'floor') participants[1].qualityOverride.minimumBitrateKbps = 384;
      if (kind === 'disabled') participants[1].isDisabled = true;
      if (kind === 'unlinked') participants[1].discoveryLinkExists = false;
      if (kind === 'approval') participants[1].wantedStatus = 'approval_pending';
      if (kind === 'membership') participants.pop();
    } });
    h.state.candidate.sourceSearchId = 'current-search';
    h.state.candidate.files = h.state.candidate.files.map((file) => ({ ...file, extension: 'mp3', bitRateKbps: 320,
      filename: file.filename.replace('.flac', '.mp3'), rawPayload: { ...file.rawPayload, filename: file.rawPayload.filename.replace('.flac', '.mp3') } }));
    h.state.item.planningSnapshot.execution.requestedFiles = h.state.candidate.files.map((file) => ({ filename: file.rawPayload.filename, size: file.sizeBytes }));
    h.state.transfers[0].filename = h.state.candidate.files[0].rawPayload.filename;
    h.state.candidate.normalizedPayload = { extensions: ['mp3'], bitrateKbps: 320,
      musicQueue: { wantedReleaseId: primaryId, wantedReleaseIds: [primaryId, siblingId], sharedOperatorDiscovery: true,
        profileCode: 'lossless_archive', minimumBitrateKbps: 256, qualityOverride: participants[0].qualityOverride },
      discoveryScope: { metadataReleaseId }, requestOwnership: { metadataReleaseId, sourceRequestedForUserId: participants[0].appUserId } };
    h.state.item.planningSnapshot.execution.sourceObservation = captureRecoveryObservation(h.state.candidate);
    const command = await reviewed(h); applying = true;
    await assert.rejects(h.service.adoptExistingDownloads({ ...h.owner, command }), { code: 'import_execution_download_adoption_not_current' });
    assert.equal(h.state.effects, 0, kind);
  }
});
