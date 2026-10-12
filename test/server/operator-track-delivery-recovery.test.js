/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateApplyOperationService } from '../../src/server/import-candidates/import-candidate-apply-operation-service.js';
import { createOperatorTrackDeliveryProgressService } from '../../src/server/metadata/operator-track-delivery-progress-service.js';
import { createOperatorTrackDeliveryRecoveryService } from '../../src/server/metadata/operator-track-delivery-recovery-service.js';
import { captureTrackDeliveryOperation, captureTrackDeliveryPlans, readTrackDeliveryProgress } from '../../src/server/metadata/operator-track-delivery-progress-policy.js';
import { createOperatorTrackSourceLifecycleService } from '../../src/server/metadata/operator-track-source-lifecycle-service.js';
import { hasOwnerTrackFulfillment } from '../../src/server/metadata/operator-track-file-policy.js';

const tracks = [1, 2].map(position => ({ metadataTrackId: `track-${position}`, metadataReleaseId: 'release',
  recordingMbid: `recording-${position}`, mediumPosition: 1, trackPosition: position, title: `Track ${position}`, lengthMs: 2000 }));
const participants = tracks.map((track, index) => ({ ownerId: `owner-${index}`, mediaRequestId: `request-${index}`,
  wantedReleaseId: `wanted-${index}`, scope: { version: 1, mode: 'tracks', metadataReleaseId: 'release', tracks: [track] } }));
const selection = { sharedDelivery: true, participants, releaseMbid: 'edition', scope: { mode: 'tracks', tracks },
  bindings: tracks.map((track, index) => ({ fileId: `file-${index}`, track })) };
const evidence = { sizeBytes: 100, sha256: 'a'.repeat(64) };
const preview = { summary: { status: 'ready' }, preview: { source: { downloadsRoot: '/downloads' },
  staging: { root: '/staging' }, library: { root: '/music', reusePolicy: {} } }, files: participants.map((owner, index) => ({
    fileId: `file-${index}`, filename: `0${index + 1} Track ${index + 1}.flac`, status: { code: 'ready' },
    sourceFile: { path: `/downloads/${index}.flac`, sizeBytes: 100, exists: true },
    stagingTarget: { path: `/staging/${index}.flac`, exists: false },
    libraryTarget: { path: `/music/${index}/track.flac`, exists: index === 0 },
    delivery: { ...owner, libraryRoot: `/music/${index}` },
  })) };

const verifiedOperation = () => captureTrackDeliveryOperation({ ...preview.files[0], libraryPath: preview.files[0].libraryTarget.path,
  status: 'applied', verifiedTrack: tracks[0], trackFileEvidence: evidence });
const expectedLease = { leaseKey: 'import_candidate_apply:run', ownerInstanceId: 'worker', acquisitionId: '11111111-1111-4111-8111-111111111111' };

function progressHarness({ event = async () => {} } = {}) {
  const candidate = { id: 'candidate', status: 'import_pending', normalizedPayload: {} };
  const authority = { run: { operation_type: 'import_candidate_apply', status: 'running', summary: { importCandidateIds: ['candidate'] } },
    lease: { ...expectedLease, expiresAt: '2026-10-12T12:01:00.000Z', releasedAt: null }, now: Date.parse('2026-10-12T12:00:00.000Z') };
  const saved = []; let events = 0;
  const input = { importCandidateId: 'candidate', operationRunId: 'run', expectedLease, applyPreview: preview, operation: verifiedOperation() };
  const service = createOperatorTrackDeliveryProgressService({ withTransaction: run => run({ query: async () => {} }),
    store: { readCandidate: async () => candidate, lockContext: async () => candidate, readAuthority: async () => authority,
      saveProgress: async value => { saved.push(value); return true; } },
    verifier: { assertCandidateCurrent: async () => selection }, fingerprintTrackFile: async () => evidence,
    mediaInspectionService: { inspectSourceFile: async () => ({ metadata: { audioStreamCount: 1, videoStreamCount: 0, durationSeconds: 2,
      tags: { title: tracks[0].title, track: '1', disc: '1', musicbrainz_trackid: tracks[0].recordingMbid, musicbrainz_albumid: 'edition' } } }) },
    assertMaintenance: async () => {}, insertEvent: async (...args) => { events++; await event(authority, ...args); },
  });
  return { service, candidate, authority, saved, input, events: () => events };
}

test('a current delivery checkpoint binds the complete participants and is replay-safe without another event', async () => {
  const h = progressHarness(); await h.service.recordDelivery(h.input);
  assert.equal(h.saved.length, 1); assert.equal(h.events(), 1);
  assert.deepEqual(h.saved[0].progress.participants, participants);
  h.candidate.normalizedPayload.operatorTrackDeliveryProgress = h.saved[0].progress;
  await h.service.recordDelivery(h.input);
  assert.equal(h.saved.length, 1); assert.equal(h.events(), 1);
});

for (const fault of ['expiry', 'replacement', 'cancel', 'scope']) test(`checkpoint refuses ${fault} before publishing evidence`, async () => {
  const h = progressHarness();
  if (fault === 'expiry') h.authority.now = Date.parse('2026-10-12T12:02:00.000Z');
  if (fault === 'replacement') h.authority.lease.acquisitionId = '22222222-2222-4222-8222-222222222222';
  if (fault === 'cancel') h.authority.run.cancel_requested_at = 'current';
  if (fault === 'scope') h.authority.run.summary.importCandidateIds = ['foreign'];
  await assert.rejects(h.service.recordDelivery(h.input), { code: 'operator_track_scope_verification_required' });
  assert.equal(h.saved.length, 0); assert.equal(h.events(), 0);
});

test('expiry during the required event fails the final current-acquisition gate', async () => {
  const h = progressHarness({ event: async authority => { authority.now = Date.parse('2026-10-12T12:02:00.000Z'); } });
  await assert.rejects(h.service.recordDelivery(h.input), { code: 'operator_track_scope_verification_required' });
  assert.equal(h.events(), 1); // Native proof owns transaction rollback, this control owns the late gate.
});

test('malformed, contradictory and changed-participant checkpoints cannot authorize adoption', () => {
  for (const progress of [null, { version: 1, participants, files: [] },
    { version: 1, participants: participants.slice(0, 1), files: [verifiedOperation()] },
    { version: 1, participants, files: [verifiedOperation(), verifiedOperation()] },
    { version: 1, participants, files: [{ ...verifiedOperation(), trackFileEvidence: { ...evidence, sha256: 'forged' } }] }]) {
    assert.throws(() => readTrackDeliveryProgress({ normalizedPayload: { operatorTrackDeliveryProgress: progress } }, selection),
      { code: 'operator_track_scope_verification_required' });
  }
});

test('a preview marker without a database checkpoint grants no delivery reuse', async () => {
  const service = createOperatorTrackDeliveryRecoveryService({ store: { readCandidate: async () => ({ normalizedPayload: {} }) } });
  assert.equal((await service.resolveDelivered({ importCandidateId: 'candidate', files: [{ forgedResume: true }] })).size, 0);
});

test('changing the pending peer plan refuses replay of an otherwise unchanged first delivery', async () => {
  const h = progressHarness(); await h.service.recordDelivery(h.input);
  h.candidate.normalizedPayload.operatorTrackDeliveryProgress = h.saved[0].progress;
  const changed = structuredClone(h.input); changed.applyPreview.files[1].libraryTarget.path = '/music/changed/track.flac';
  await assert.rejects(h.service.recordDelivery(changed), { code: 'operator_track_scope_verification_required' });
  assert.equal(h.saved.length, 1); assert.equal(h.events(), 1);
});

test('a delivered-file hash change during media inspection refuses recovery before any mutation', async () => {
  let fingerprints = 0;
  const candidate = { status: 'import_pending', normalizedPayload: { operatorTrackDeliveryProgress: {
    version: 1, participants, plans: captureTrackDeliveryPlans(preview.files), files: [verifiedOperation()] } } };
  const recovery = createOperatorTrackDeliveryRecoveryService({ store: { readCandidate: async () => candidate },
    verifier: { assertCandidateCurrent: async () => selection },
    fingerprintTrackFile: async () => ++fingerprints === 1 ? evidence : { ...evidence, sha256: 'b'.repeat(64) },
    mediaInspectionService: { inspectSourceFile: async () => ({ metadata: { audioStreamCount: 1, videoStreamCount: 0, durationSeconds: 2,
      tags: { title: tracks[0].title, track: '1', disc: '1', musicbrainz_trackid: tracks[0].recordingMbid, musicbrainz_albumid: 'edition' } } }) },
  });
  await assert.rejects(recovery.resolveDelivered({ importCandidateId: 'candidate', files: preview.files }), { code: 'operator_track_scope_verification_required' });
});

test('current available receipt prevents an older missing copy from reopening the same owned source', async () => {
  const calls = []; const events = [];
  const lifecycle = createOperatorTrackSourceLifecycleService({ store: { transitionSource: async ({ source }) => { calls.push(source); return true; },
    insertEvent: async ({ source }) => events.push(source) } });
  const source = { ownerId: participants[0].ownerId, mediaRequestId: participants[0].mediaRequestId, scope: participants[0].scope };
  await lifecycle.reconcileSources({ queryable: {}, sources: [{ ...source, available: true }, { ...source, available: false }] });
  assert.equal(calls.length, 1); assert.equal(calls[0].available, true); assert.equal(events.length, 1);
});

test('a reopened owner source cannot claim current fulfillment from its historical applied receipt', () => {
  const receipt = { version: 1, ownerId: participants[0].ownerId, sourceMediaRequestId: participants[0].mediaRequestId, scope: participants[0].scope,
    files: [{ libraryPath: '/music/0/track.flac', track: tracks[0], evidence }] };
  const request = { id: participants[0].mediaRequestId, requestedForUser: { id: participants[0].ownerId },
    evidence: { operatorArtistReconciliation: { operatorTrackScope: participants[0].scope },
      operatorTrackSourceLifecycle: { version: 1, state: 'reopened', scope: participants[0].scope } } };
  assert.equal(hasOwnerTrackFulfillment({ request, candidate: { status: 'applied', normalizedPayload: { operatorTrackFulfillment: receipt } } }), false);
});

test('a durably reverified first delivery resumes only the unresolved recipient without another first-file mutation', async () => {
  const mutations = [];
  const operation = { ...preview.files[0], libraryPath: preview.files[0].libraryTarget.path, status: 'applied',
    verifiedTrack: tracks[0], trackFileEvidence: evidence };
  const service = createImportCandidateApplyOperationService({
    assertTrackScopeCurrent: async () => selection,
    trackDeliveryRecoveryService: { resolveDelivered: async () => new Map([['file-0', operation]]) },
    fingerprintTrackFile: async () => evidence,
    mediaInspectionService: { inspectSourceFile: async ({ sourcePath }) => {
      const index = sourcePath.includes('/1') ? 1 : 0;
      return { metadata: { audioStreamCount: 1, videoStreamCount: 0, durationSeconds: 2,
        tags: { title: tracks[index].title, track: String(index + 1), disc: '1', musicbrainz_trackid: tracks[index].recordingMbid, musicbrainz_albumid: 'edition' } } };
    } },
    mediaFilesystemService: { createExclusiveFileMutationPlan: value => value,
      applyExclusiveFileMutationPlan: async plan => {
        mutations.push(plan);
        if (plan.destinationPath === preview.files[0].libraryTarget.path) throw Object.assign(new Error('Existing first delivery'), { code: 'EEXIST' });
        return { appliedMode: 'copy', transport: 'copy_only', verification: { status: 'verified' } };
      } },
  });
  const result = await service.applyImportCandidatePreview({ importCandidateId: 'candidate', applyPreview: preview });
  assert.equal(result.summary.failedFileCount, 0);
  assert.equal(result.summary.resumedDeliveryCount, 1); assert.equal(result.summary.appliedFileCount, 2);
  assert.equal(mutations.length, 2);
  assert.equal(mutations.every(plan => !plan.sourcePath.includes('/0') && !plan.destinationPath.includes('/0')), true);
  assert.deepEqual(result.fileOperations[0].trackFileEvidence, evidence);
});
