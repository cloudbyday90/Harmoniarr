/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createQualityReviewFailedCandidateStore } from '../../src/server/import-candidates/quality-review-failed-candidate-store.js';
import { createImportCandidateQualityReviewScopeService } from '../../src/server/import-candidates/import-candidate-quality-review-scope-service.js';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
test('owned review projection binds both owner and target and excludes unrelated prepared-add child access', async () => {
  const queryable = { query: async (sql, values) => {
    assert.deepEqual(values, [id(2), id(3)]);
    assert.match(sql, /lwr\.id=\$1::uuid AND lwr\.app_user_id=\$2::uuid/u);
    assert.doesNotMatch(sql, /release_prepared_add|import_candidate_files|import_candidate_file_decisions/u);
    return { rows: [] };
  } };
  const store = createQualityReviewFailedCandidateStore({ getPoolFn: () => assert.fail('Keep owning client') });
  assert.equal(await store.readOwnedReview({ appUserId: id(3), wantedReleaseId: id(2), queryable }), null);
});
test('minimal facts and parent locks retain the owning client without requesting provider or child detail', async () => {
  const calls = []; const queryable = { query: async (sql, values) => {
    calls.push(sql); assert.deepEqual(values, ["untrusted' identifier"]); assert.ok(!sql.includes("untrusted' identifier"));
    assert.doesNotMatch(sql, /raw_payload|import_candidate_files|import_candidate_file_decisions|SELECT \*/u);
    return { rows: [{ id: id(1), status: 'failed', source_search_id: 'search', policy_payload: { musicQueue: null } }] };
  } };
  const store = createQualityReviewFailedCandidateStore({ getPoolFn: () => assert.fail('Use the owning client') });
  assert.deepEqual(await store.readFacts({ importCandidateId: "untrusted' identifier", queryable }),
    { id: id(1), status: 'failed', sourceSearchId: 'search', normalizedPayload: { musicQueue: null } });
  await store.lockFailedCandidate({ importCandidateId: "untrusted' identifier", queryable });
  assert.match(calls[1], /FOR UPDATE$/u); assert.doesNotMatch(calls[0], /FOR UPDATE/u);
  await assert.rejects(store.lockFailedCandidate({ importCandidateId: id(1) }), TypeError);
  assert.equal(calls.length, 2);
});

test('qualification uses only its fact reader/root lock and rereads current policy after locking', async () => {
  const events = []; let floor = 256; let reads = 0;
  const release = { metadataReleaseId: id(4), targetUser: {}, libraryAddRecoveryFacts: {
    candidateId: id(1), candidateStatus: 'failed', addBlockerCode: 'media_verification', recoveryReasonCode: 'suspicious_lossless', hasConflictingCandidate: false } };
  const queryable = { query: async sql => { assert.equal(sql, 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED'); events.push('isolation'); } };
  const service = createImportCandidateQualityReviewScopeService({
    getImportCandidate: async () => assert.fail('Qualification must not load full candidate/files'),
    failedCandidateStore: { readOwnedReview: async () => release, readFacts: async input => {
      assert.equal(input.importCandidateId, id(1)); reads++;
      return { id: id(1), status: 'failed', sourceSearchId: 'search', normalizedPayload: {
        musicQueue: { wantedReleaseId: id(2), profileCode: 'lossless_archive', minimumBitrateKbps: floor } } };
    }, lockFailedCandidate: async input => { assert.equal(input.queryable, queryable); events.push('parent'); floor = 320; } },
    recheckStore: { readOwnedRelease: async () => assert.fail('Qualification must not load unrelated prepared-add facts'),
    readParticipantPolicies: async () => [{ wantedReleaseId: id(2), appUserId: id(3), metadataReleaseId: id(4),
      wantedStatus: 'missing', missingTrackCount: 1, discoveryLinkExists: true, qualityPreferences: {} }],
    readSelectionActor: async () => { events.push('actor'); return { id: id(3) }; },
    lockCandidate: async () => assert.fail('Qualification must not take the selection file/decision locks'),
    lockParticipantReleases: async () => { events.push('wanted'); } },
    assertMaintenanceWriteAllowed: async () => { events.push('maintenance'); },
    lockAppUserEligibilityFn: async () => { events.push('accounts'); }, lockRunCreation: async () => { events.push('admission'); },
    withTransaction: async execute => execute(queryable),
  });
  const input = { actorUserId: id(3), appUserId: id(3), wantedReleaseId: id(2) };
  await service.withCurrentQualificationScope(input, ({ scope, queryable: current }) => {
    assert.equal(current, queryable); assert.equal(scope.requiredContext.minimumBitrateKbps, 320); events.push('execute');
  });
  assert.equal(reads, 2);
  assert.deepEqual(events, ['isolation','maintenance','accounts','wanted','admission','parent','actor','execute']);
  await assert.rejects(service.withCurrentQualificationScope({ ...input, importCandidateId: id(5) }, () => assert.fail()), { code: 'missing_music_match_changed' });
  assert.equal(reads, 2, 'Qualification never accepts selection input');
});
