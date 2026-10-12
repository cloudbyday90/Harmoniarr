/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { selectOperatorTrackFiles, assertOperatorTrackManifest, assertOperatorTrackMedia, hasOwnerTrackFulfillment } from '../../src/server/metadata/operator-track-file-policy.js';
import { createLibraryDiscoveryQualityContextService } from '../../src/server/library/library-discovery-quality-context-service.js';
import { createOperatorTrackScopeVerificationService } from '../../src/server/metadata/operator-track-scope-verification-service.js';
import { buildMediaRequestFulfillmentStatus } from '../../src/server/library/library-media-request-fulfillment-service.js';
import { createExecutionWorkerHarness, executionCandidate } from '../../testing/server/import-execution-worker-harness.js';
import { buildLibraryWantedReleaseProjection } from '../../src/server/library/library-wanted-release-projection-service.js';

const track = { metadataTrackId: 'track', metadataReleaseId: 'release', recordingMbid: 'recording',
  mediumPosition: 1, trackPosition: 1, title: 'Foil', lengthMs: 300000 };
const scope = { version: 1, mode: 'tracks', metadataReleaseId: 'release', tracks: [track] };
const first = { id: 'file-one', filename: '01 Foil.flac', folderPath: 'Artist\\Album', extension: 'flac', sizeBytes: 100,
  lengthSeconds: 300, isLocked: false };
const second = { ...first, id: 'file-two', filename: '02 Second.flac' };
const candidate = { normalizedPayload: { musicQueue: { operatorTrackScopes: [{ mediaRequestId: 'request', scope }] } }, files: [first, second] };
const inspection = { metadata: { audioStreamCount: 1, videoStreamCount: 0, durationSeconds: 300,
  tags: { title: 'Foil', musicbrainz_trackid: 'recording', musicbrainz_albumid: 'edition', track: '1/2', disc: '1/1' } } };
const refused = { code: 'operator_track_scope_verification_required' };

test('one requested track selects one exact file and excludes the sibling and artwork', () => {
  const selection = selectOperatorTrackFiles({ ...candidate, files: [...candidate.files, { id: 'cover', filename: 'cover.jpg', extension: 'jpg' }] });
  assert.deepEqual(selection.files, [first]);
  assert.deepEqual(selection.bindings, [{ fileId: first.id, track }]);
  assertOperatorTrackManifest(selection, [{ filename: 'Artist\\Album\\01 Foil.flac', size: 100 }]);
  assert.throws(() => assertOperatorTrackManifest(selection, [{ filename: 'Artist\\Album\\01 Foil.flac', size: 100 },
    { filename: 'Artist\\Album\\02 Second.flac', size: 100 }]), refused);
});
test('the completed execution worker sends only the selected track manifest to the provider', async t => {
  const ready = executionCandidate({ files: [first, second], normalizedPayload: candidate.normalizedPayload });
  const harness = createExecutionWorkerHarness(t, { candidates: [ready] });
  try {
    await harness.run();
    assert.equal(harness.marks.failed, null);
    assert.ok(harness.marks.completed);
    assert.deepEqual(harness.enqueueDownloads.mock.calls[0].arguments[0].files,
      [{ filename: 'Artist\\Album\\01 Foil.flac', size: 100 }]);
    assert.equal(harness.items.get(ready.id).planningSnapshot.execution.requestedFiles.length, 1);
  } finally { await harness.worker.close(); }
});
for (const [name, files] of [['missing', [second]], ['ambiguous', [first, { ...first, id: 'duplicate' }]],
  ['locked', [{ ...first, isLocked: true }]], ['wrong duration', [{ ...first, lengthSeconds: 270 }]],
  ['zero size', [{ ...first, sizeBytes: 0 }]], ['wrong position', [{ ...first, filename: '02 Foil.flac' }]]]) {
  test(`${name} file cannot authorize selected track download`, () => assert.throws(() => selectOperatorTrackFiles({ ...candidate, files }), refused));
}
test('a contradictory raw provider path cannot substitute the sibling after file matching', () => {
  assert.throws(() => selectOperatorTrackFiles({ ...candidate, files: [{ ...first,
    rawPayload: { filename: 'Artist\\Album\\02 Second.flac' } }] }), refused);
});
test('catalog equality accepts a proper one-track subset but rejects a changed catalog row', async () => {
  let rows = [track, { ...track, metadataTrackId: 'second', trackPosition: 2 }];
  const verifier = createOperatorTrackScopeVerificationService({ catalogStore: { listTrackCatalog: async () => rows } });
  await verifier.assertScopesCurrent([{ scope }]);
  rows = [{ ...track, recordingMbid: 'changed' }, rows[1]];
  await assert.rejects(verifier.assertScopesCurrent([{ scope }]), refused);
});
test('a source-less Wanted subset cannot begin discovery or acquire a candidate', async () => {
  const context = createLibraryDiscoveryQualityContextService({ trackScopeVerifier: { assertScopesCurrent: async () => {} } });
  await assert.rejects(context.resolveSharedDiscoveryQualityContext({ operatorLinks: [
    { wantedReleaseId: 'wanted', appUserId: 'owner', operatorTrackScope: scope, qualityPreferences: {} }] }), refused);
  const verifier = createOperatorTrackScopeVerificationService();
  await assert.rejects(verifier.assertCandidateCurrent(candidate), refused);
});
test('media must match release, recording, disc, position, title and measured duration', () => {
  assertOperatorTrackMedia({ track, releaseMbid: 'edition', inspection });
  for (const tags of [{ musicbrainz_trackid: 'other' }, { musicbrainz_albumid: 'other-edition' }, { track: '2/2' }, { disc: '2' }, { title: 'Second' }, { track: '1evil' }]) {
    assert.throws(() => assertOperatorTrackMedia({ track, releaseMbid: 'edition', inspection: {
      metadata: { ...inspection.metadata, tags: { ...inspection.metadata.tags, ...tags } } } }), refused);
  }
  for (const metadata of [null, { ...inspection.metadata, audioStreamCount: 0 }, { ...inspection.metadata, videoStreamCount: 1 },
    { ...inspection.metadata, durationSeconds: 310 }]) assert.throws(() => assertOperatorTrackMedia({ track, releaseMbid: 'edition', inspection: { metadata } }), refused);
});
for (const link of [{ wantedReleaseId: 'other', appUserId: 'other', qualityPreferences: {} },
  { wantedReleaseId: 'other', appUserId: 'other', qualityPreferences: {}, operatorTrackScope: { ...scope, mode: 'release' } },
  { wantedReleaseId: 'other', appUserId: 'other', qualityPreferences: {}, operatorTrackScope: { ...scope, tracks: [{ ...track, trackPosition: 2 }] } }]) {
  test(`incompatible shared participant stays visible and blocks subset search (${JSON.stringify(link.operatorTrackScope)})`, async () => {
    const service = createLibraryDiscoveryQualityContextService({ trackScopeVerifier: { assertScopesCurrent: async () => {} } });
    await assert.rejects(service.resolveSharedDiscoveryQualityContext({ operatorLinks: [
      { wantedReleaseId: 'first', appUserId: 'owner', qualityPreferences: {}, operatorTrackScope: scope }, link] }), refused);
  });
}
test('applied folder status alone cannot fulfill one person or their sibling requirement', () => {
  const request = { id: 'request', requestedForUser: { id: 'owner' }, evidence: { operatorArtistReconciliation: { operatorTrackScope: scope } } };
  const applied = { ...candidate, id: 'candidate', status: 'applied' };
  assert.equal(buildMediaRequestFulfillmentStatus({ request, importCandidates: [applied] }).code, 'under_review');
  const receipt = { version: 1, ownerId: 'owner', sourceMediaRequestId: request.id, scope,
    files: [{ libraryPath: '/library/01 Foil.flac', track, evidence: { sizeBytes: 100, sha256: 'a'.repeat(64) } }] };
  const verified = { ...applied, normalizedPayload: { ...applied.normalizedPayload, operatorTrackFulfillment: receipt } };
  assert.equal(hasOwnerTrackFulfillment({ request, candidate: verified }), true);
  assert.equal(buildMediaRequestFulfillmentStatus({ request, importCandidates: [verified] }).code, 'fulfilled');
  assert.equal(hasOwnerTrackFulfillment({ request: { ...request, requestedForUser: { id: 'other-owner' } }, candidate: verified }), false);
  assert.equal(hasOwnerTrackFulfillment({ request: { ...request, evidence: { operatorArtistReconciliation: {
    operatorTrackScope: { ...scope, tracks: [{ ...track, metadataTrackId: 'second', trackPosition: 2 }] } } } }, candidate: verified }), false);
});
for (const reconciliationStatus of ['complete', 'duplicate']) {
  test(`global ${reconciliationStatus} counts cannot satisfy an owner-specific selected track`, () => {
    const rows = buildLibraryWantedReleaseProjection({ appUserId: 'owner',
      artistPayload: { artist: { id: 'artist' }, releaseGroups: [{ id: 'group', primaryType: 'album', title: 'Album' }],
        releases: [{ id: 'release', releaseGroupId: 'group', isCanonical: true, title: 'Album', trackCount: 2 }],
        trackCatalog: [track, { ...track, metadataTrackId: 'second', trackPosition: 2, title: 'Second' }] },
      monitoring: { isMonitored: true, releaseScope: 'track_only', wantedAutomationMode: 'manual_only', monitoredReleaseGroupTypes: ['album'] },
      trackOverrides: [{ metadataReleaseGroupId: 'group', recordingMbid: track.recordingMbid,
        mediumPosition: 1, trackPosition: 1, isDesired: true, remapStatus: 'resolved' }],
      libraryReleaseReconciliations: [{ metadataReleaseId: 'release', reconciliationStatus, expectedTrackCount: 2, matchedTrackCount: 2 }] });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].matchedTrackCount, 0);
    assert.equal(rows[0].missingTrackCount, 1);
    assert.deepEqual(rows[0].evidence.operatorTrackScope, scope);
  });
}
