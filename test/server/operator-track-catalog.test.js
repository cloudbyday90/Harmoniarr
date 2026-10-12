/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperatorTrackScope, resolveOperatorTrackOverride, hasBlockedOperatorTrackScopes } from '../../src/server/metadata/operator-track-scope-policy.js';
import { createOperatorTrackScopeVerificationService } from '../../src/server/metadata/operator-track-scope-verification-service.js';
import { createLibraryDiscoveryQualityContextService } from '../../src/server/library/library-discovery-quality-context-service.js';
import { createImportExecutionPreProviderService } from '../../src/server/import-candidates/import-execution-pre-provider-service.js';
import { createImportCandidateAutoSelectionService } from '../../src/server/import-candidates/import-candidate-auto-selection-service.js';
import { createImportCandidateApplyOperationService } from '../../src/server/import-candidates/import-candidate-apply-operation-service.js';

const track = { metadataTrackId: 'track', metadataReleaseId: 'release', recordingMbid: 'recording',
  mediumPosition: 1, trackPosition: 1, title: 'Track', lengthMs: 300000 };
const override = { metadataReleaseId: 'release', recordingMbid: 'recording', mediumPosition: 1, trackPosition: 1,
  isDesired: true, remapStatus: 'resolved' };
const scope = buildOperatorTrackScope({ metadataReleaseId: 'release', trackCatalog: [track], trackOverrides: [override] });

for (const patch of [{ recordingMbid: 'unknown' }, { mediumPosition: 2 }, { trackPosition: 2 },
  { trackMbid: 'unsupported' }, { metadataReleaseId: 'other' }, { remapStatus: 'review_needed' }, { isDesired: false }]) {
  test(`catalog membership refuses ${JSON.stringify(patch)}`, () => {
    assert.equal(resolveOperatorTrackOverride({ ...override, ...patch }, 'release', [track]), null);
  });
}
test('recording and position resolve one current track without conflating another occurrence', () => {
  assert.deepEqual(resolveOperatorTrackOverride(override, 'release', [track, { ...track, metadataTrackId: 'other', trackPosition: 2 }]), track);
  assert.equal(resolveOperatorTrackOverride(override, 'release', [track, { ...track, metadataTrackId: 'duplicate' }]), null);
});
test('null binding preserves group scope, while incomplete desired identity blocks the complete requirement', () => {
  assert.equal(buildOperatorTrackScope({ metadataReleaseId: 'release', trackCatalog: [track],
    trackOverrides: [{ ...override, metadataReleaseId: null }] }).mode, 'release');
  assert.equal(buildOperatorTrackScope({ metadataReleaseId: 'release', trackCatalog: [track],
    trackOverrides: [override, { ...override, recordingMbid: 'unknown' }] }).mode, 'unresolved');
});
test('verified subset cannot be treated as release-wide work', () => {
  const subset = buildOperatorTrackScope({ metadataReleaseId: 'release', trackCatalog: [track, { ...track, metadataTrackId: 'second', trackPosition: 2 }], trackOverrides: [override] });
  assert.equal(subset.mode, 'tracks');
  assert.equal(hasBlockedOperatorTrackScopes({ operatorTrackScopes: [{ wantedReleaseId: 'wanted', scope: subset }] }), true);
  assert.equal(hasBlockedOperatorTrackScopes({ operatorTrackScopes: [{ mediaRequestId: 'request', scope }] }), false);
});
for (const invalid of [null, [], [{ scope: null }], [{ scope: { ...scope, mode: 'tracks' } }]]) {
  test(`invalid/subset requirement refuses before catalog reads (${JSON.stringify(invalid)})`, async () => {
    const verifier = createOperatorTrackScopeVerificationService({ catalogStore: { listTrackCatalog: async () => assert.fail('Refusal must precede read') } });
    await assert.rejects(verifier.assertScopesCurrent(invalid), { code: 'operator_track_scope_verification_required' });
  });
}
test('current catalog equality and the owned queryable protect whole-release scope', async () => {
  const calls = []; let rows = [track];
  const queryable = { query: async sql => { calls.push(sql); return { rows: [] }; } };
  const verifier = createOperatorTrackScopeVerificationService({ getPoolFn: () => assert.fail('No extra checkout'),
    catalogStore: { listTrackCatalog: async input => { assert.equal(input.queryable, queryable); return rows; } } });
  await verifier.assertScopesCurrent([{ scope }], { queryable });
  assert.match(calls[0], /pg_advisory_xact_lock_shared/u);
  rows = [{ ...track, recordingMbid: 'changed' }];
  await assert.rejects(verifier.assertScopesCurrent([{ scope }], { queryable }), { code: 'operator_track_scope_verification_required' });
});
test('shared scope keeps every participant and persists owner-specific requirements', async () => {
  let observed;
  const service = createLibraryDiscoveryQualityContextService({ trackScopeVerifier: { assertScopesCurrent: async scopes => { observed = scopes; } } });
  const result = await service.resolveSharedDiscoveryQualityContext({ operatorLinks: [
    { wantedReleaseId: 'wanted-one', appUserId: 'user-one', operatorTrackScope: scope, qualityPreferences: {} },
    { wantedReleaseId: 'wanted-two', appUserId: 'user-two', qualityPreferences: {} },
  ] });
  assert.deepEqual(result.wantedReleaseIds, ['wanted-one', 'wanted-two']);
  assert.deepEqual(result.operatorTrackScopes, [{ wantedReleaseId: 'wanted-one', scope }]);
  assert.deepEqual(observed, result.operatorTrackScopes);
});

test('legacy preparation refuses a current request subset before epoch, audit or provider preparation', async () => {
  const requestId = '71000000-0000-4000-8000-000000000001';
  const candidate = { normalizedPayload: { requestOwnership: { sourceMediaRequestId: requestId } } };
  const queryable = { query: async sql => {
    assert.match(sql, /FROM media_requests/u);
    return { rows: [{ matched_metadata_release_id: 'release', evidence: { operatorArtistReconciliation: {
      operatorTrackScope: { ...scope, mode: 'tracks' } } } }] };
  } };
  const service = createImportExecutionPreProviderService({ withTransaction: work => work(queryable),
    store: { lockContext: async () => ({ run: { summary: {} }, item: {}, candidate }),
      saveEpoch: async () => assert.fail('Subset cannot persist preparation'), isCurrentOrigin: async () => true,
      findUnresolvedOtherHandoff: async () => null }, recordAuditEventFn: async () => assert.fail('Subset cannot admit an epoch') });
  await assert.rejects(service.beginPreparation({}), { code: 'operator_track_scope_verification_required' });
});

test('fresh requirement refusal prevents high-confidence selection', async () => {
  const error = Object.assign(new Error('scope'), { code: 'operator_track_scope_verification_required' });
  const service = createImportCandidateAutoSelectionService({ listImportCandidates: async () => ({ candidates: [
    { id: 'candidate', status: 'pending', normalizedPayload: { compositeScore: 99 } }], pagination: { total: 1 } }),
  selectImportCandidate: async () => assert.fail('Scope refusal must precede selection'),
  trackScopeVerifier: { assertCandidateCurrent: async () => { throw error; } } });
  await assert.rejects(service.selectHighConfidenceCandidate({ sourceSearchId: 'search' }), value => value === error);
});

test('manual apply also checks track authority before filesystem or media work', async () => {
  const error = Object.assign(new Error('scope'), { code: 'operator_track_scope_verification_required' });
  const service = createImportCandidateApplyOperationService({ assertTrackScopeCurrent: async () => { throw error; },
    statFn: async () => assert.fail('Scope refusal precedes filesystem inspection'),
    recordImportOperationFn: async () => assert.fail('Scope refusal precedes mutation recording') });
  await assert.rejects(service.applyImportCandidatePreview({ importCandidateId: 'candidate',
    applySafetyMode: 'manual', applyPreview: { files: [{ filename: 'Track.flac' }], summary: { status: 'ready' } } }), value => value === error);
});
