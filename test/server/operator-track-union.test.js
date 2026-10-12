/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getOperatorTrackRequirements, selectOperatorTrackFiles, assertOperatorTrackManifest, hasOwnerTrackFulfillment } from '../../src/server/metadata/operator-track-file-policy.js';
import { createOperatorTrackParticipantService } from '../../src/server/metadata/operator-track-participant-service.js';
import { createOperatorTrackDeliveryPlanService } from '../../src/server/metadata/operator-track-delivery-plan-service.js';
import { createExecutionWorkerHarness, executionCandidate } from '../../testing/server/import-execution-worker-harness.js';
import { createOperatorArtistDesiredStateService } from '../../src/server/metadata/operator-artist-desired-state-service.js';
import { createLibraryMediaRequestFulfillmentService } from '../../src/server/library/library-media-request-fulfillment-service.js';

const track = position => ({ metadataTrackId: `track-${position}`, metadataReleaseId: 'release', recordingMbid: `recording-${position}`,
  mediumPosition: 1, trackPosition: position, title: `Track ${position}`, lengthMs: 2000 });
const scope = position => ({ version: 1, mode: 'tracks', metadataReleaseId: 'release', tracks: [track(position)] });
const owners = [1, 2].map(i => ({ ownerId: `owner-${i}`, wantedReleaseId: `wanted-${i}`, mediaRequestId: `request-${i}`, scope: scope(i) }));
const context = { operatorTrackScopes: owners.map(owner => ({ wantedReleaseId: owner.wantedReleaseId, scope: owner.scope })), operatorTrackParticipants: owners };
const files = [1, 2, 3].map(i => ({ id: `file-${i}`, filename: `0${i} Track ${i}.flac`, folderPath: 'Artist\\Album', extension: 'flac',
  lengthSeconds: 2, sizeBytes: 100 + i, isLocked: false }));
const selection = { ...selectOperatorTrackFiles({ files, normalizedPayload: { musicQueue: context } }), participants: owners };
const refused = { code: 'operator_track_scope_verification_required' };

test('the exact union is stable across participant order and excludes an unrequested third track', () => {
  assert.deepEqual(getOperatorTrackRequirements([...context.operatorTrackScopes].reverse()), [track(1), track(2)]);
  assert.deepEqual(selection.files, files.slice(0, 2));
  assert.equal(selection.sharedDelivery, true);
  assertOperatorTrackManifest(selection, files.slice(0, 2).map(file => ({ filename: `${file.folderPath}\\${file.filename}`, size: file.sizeBytes })));
  assert.throws(() => assertOperatorTrackManifest(selection, files.map(file => ({ filename: `${file.folderPath}\\${file.filename}`, size: file.sizeBytes }))), refused);
});
test('the completed worker sends one union payload, not one folder download per recipient', async t => {
  const candidate = executionCandidate({ files, normalizedPayload: { musicQueue: context } });
  const harness = createExecutionWorkerHarness(t, { candidates: [candidate] });
  try {
    await harness.run();
    assert.equal(harness.marks.failed, null);
    assert.ok(harness.marks.completed);
    assert.equal(harness.enqueueDownloads.mock.callCount(), 1);
    assert.deepEqual(harness.enqueueDownloads.mock.calls[0].arguments[0].files,
      files.slice(0, 2).map(file => ({ filename: `${file.folderPath}\\${file.filename}`, size: file.sizeBytes })));
  } finally { await harness.worker.close(); }
});
for (const scopes of [[null], [...context.operatorTrackScopes, { scope: scope(3) }],
  [context.operatorTrackScopes[0], { scope: { ...scope(2), mode: 'release' } }],
  [context.operatorTrackScopes[0], { scope: { ...scope(2), metadataReleaseId: 'other' } }]]) {
  test(`unsupported union refuses without dropping a participant (${JSON.stringify(scopes)})`, () => assert.throws(() => getOperatorTrackRequirements(scopes), refused));
}
test('current owned requests resolve stable recipient identities and do not admit a missing or changed request', async () => {
  let requests = owners.map(owner => ({ id: owner.mediaRequestId, requested_for_user_id: owner.ownerId,
    evidence: { operatorArtistReconciliation: { operatorTrackScope: owner.scope } } }));
  const queryable = {};
  const service = createOperatorTrackParticipantService({ store: { readParticipantRequests: async input => {
    assert.equal(input.queryable, queryable); return requests;
  } } });
  const input = { participants: owners, sourceRequestId: 'request-1', metadataReleaseId: 'release', queryable };
  assert.deepEqual(await service.resolveParticipants(input), owners);
  requests = requests.slice(0, 1);
  await assert.rejects(service.resolveParticipants(input), refused);
  requests = [{ id: 'replacement', requested_for_user_id: 'owner-1', evidence: { operatorArtistReconciliation: { operatorTrackScope: scope(1) } } },
    { id: 'request-2', requested_for_user_id: 'owner-2', evidence: { operatorArtistReconciliation: { operatorTrackScope: scope(2) } } }];
  await assert.rejects(service.resolveParticipants(input), refused);
});
test('each file goes only to its current recipient root; path traversal and changed/overlapping roots refuse', async () => {
  let roots = { 'owner-1': 'first', 'owner-2': 'second' };
  const service = createOperatorTrackDeliveryPlanService({ store: { readDeliveryOwner: async ({ ownerId }) => ({
    id: ownerId, managed_library_relative_root: roots[ownerId], is_disabled: false }) }, loadSettingsFn: async () => ({ paths: { music: '/music' } }) });
  const previews = await service.planFilePreviews({ selection, relativeFolderPath: 'Artist/Album',
    filePreviews: files.slice(0, 2).map(file => ({ fileId: file.id, filename: file.filename })) });
  assert.deepEqual(previews.map(file => file.libraryPath), ['/music/users/first/Artist/Album/01 Track 1.flac', '/music/users/second/Artist/Album/02 Track 2.flac']);
  await service.assertPreviewCurrent({ selection, files: previews });
  const malicious = structuredClone(previews); malicious[0].libraryPath = '/music/users/first/../second/01 Track 1.flac';
  await assert.rejects(service.assertPreviewCurrent({ selection, files: malicious }), refused);
  roots['owner-2'] = 'changed';
  await assert.rejects(service.assertPreviewCurrent({ selection, files: previews }), refused);
  roots['owner-2'] = 'first';
  await assert.rejects(service.assertRecipientsCurrent({ selection }), refused);
});
test('separate receipts fulfill only their exact owner, request and track', () => {
  const receipts = owners.map(owner => ({ version: 1, ownerId: owner.ownerId, sourceMediaRequestId: owner.mediaRequestId,
    scope: owner.scope, files: [{ libraryPath: `/music/${owner.ownerId}/file.flac`, track: owner.scope.tracks[0],
      evidence: { sizeBytes: 101, sha256: 'a'.repeat(64) } }] }));
  const candidate = { status: 'applied', normalizedPayload: { operatorTrackFulfillment: { version: 2, receipts } } };
  for (const owner of owners) {
    const request = { id: owner.mediaRequestId, requestedForUser: { id: owner.ownerId }, evidence: { operatorArtistReconciliation: { operatorTrackScope: owner.scope } } };
    assert.equal(hasOwnerTrackFulfillment({ candidate, request }), true);
    assert.equal(hasOwnerTrackFulfillment({ candidate, request: { ...request, requestedForUser: { id: 'third-person' } } }), false);
  }
});
test('malformed participant/receipt markers remain bounded review history, without granting fulfillment', async () => {
  const candidate = { id: 'candidate', status: 'applied', normalizedPayload: { requestOwnership: { sourceMediaRequestId: 'request-1' },
    musicQueue: { operatorTrackParticipants: [null] }, operatorTrackFulfillment: { version: 2, receipts: [null, null] } } };
  const requests = await createLibraryMediaRequestFulfillmentService({ listImportCandidatesBySourceMediaRequestIds: async () => [candidate] }).enrichMediaRequests([
    { id: 'request-1', requestedForUser: { id: 'owner-1' }, evidence: { operatorArtistReconciliation: { operatorTrackScope: scope(1) } } }]);
  assert.equal(requests[0].fulfillmentStatus.code, 'under_review');
});
for (const requestStatus of ['ready', 'blocked', 'cooldown']) {
  test(`shared ${requestStatus} discovery cannot suppress a new owner's typed request; their own active request still blocks duplicates`, () => {
    const input = { monitoring: { isMonitored: true }, releaseGroups: [{ id: 'group', operatorState: {
      selectionState: 'partial', resolvedRelease: { id: 'release', title: 'Album' },
      operatorTrackScope: scope(1), trackOverrideSummary: { resolvedDesiredCount: 1 } } }],
    discoveryRequestsByReleaseId: new Map([['release', { requestStatus }]]) };
    const planner = createOperatorArtistDesiredStateService();
    assert.equal(planner.buildDesiredStatePlan(input).desiredReleases[0].eligibleForDownstreamWork, true);
    const ownActive = planner.buildDesiredStatePlan({ ...input, activeRequestsByReleaseId: new Map([['release', { id: 'owned-request' }]]) });
    assert.equal(ownActive.desiredReleases[0].blockReason, 'active_request_exists');
    assert.equal(ownActive.summary.activeRequestBlockedCount, 1);
  });
}
