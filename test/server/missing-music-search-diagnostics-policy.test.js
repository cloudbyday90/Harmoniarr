import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMissingMusicSearchDiagnostics as build, buildMissingMusicSearchCorrectionPermissions as permissions } from '../../src/server/missing-music/missing-music-search-diagnostics-policy.js';
const diagnostics = { provider: 'slskd', candidateCount: 0, responseCount: 4, responseFileCount: 10,
  ignoredUserResponseCount: 2, blacklistedFileCount: 3, missingUsernameResponseCount: 1, malformedFileCount: 2 };
const result = { sourceProvider: 'slskd', candidateCount: 0, fileCount: 0, ingestionDiagnostics: diagnostics };
const release = (evidence = {}, requestStatus = 'cooldown') => ({ discoveryRequest: { requestStatus,
  evidence: { lastSearchResult: result, ...evidence } } });
test('last recorded search exposes bounded counts and keeps private evidence out of the public projection', () => {
  const value = build(release({ lastSearchQuery: 'private', lastSearchResult: { ...result,
    ingestionDiagnostics: { ...diagnostics, reasonCodes: ['private'], filename: '/private' } } }));
  assert.deepEqual(value, diagnostics);
  assert.equal(build(release({}, 'blocked')).responseCount, 4);
  assert.doesNotMatch(JSON.stringify(value), /private/);
});
test('new work, failure, success and unverified history cannot inherit stale diagnostic causes', () => {
  for (const state of ['ready', 'running', 'searching', 'failed']) assert.equal(build(release({}, state)), null);
  for (const evidence of [{ lastDispatchFailure: { code: 'slskd_unavailable' } }, { searchContinuation: { searchId: 'saved' } },
    { lastSearchResult: { ...result, candidateCount: 1 } }, { lastSearchResult: { ...result, fileCount: 1 } },
    { lastSearchResult: { ...result, sourceProvider: 'unknown' } }, { lastSearchResult: null }]) {
    assert.equal(build(release(evidence)), null);
  }
});

test('only an administrator on an active recipient receives cause-specific review capabilities', () => {
  const allowed = { actorUser: { role: 'admin' }, targetUser: { accountStatus: 'active' }, searchDiagnostics: diagnostics };
  const denied = { canReviewIgnoredSources: false, canReviewProviderConnection: false };
  assert.deepEqual(permissions(allowed), { canReviewIgnoredSources: true, canReviewProviderConnection: true });
  for (const role of ['requester', 'operator', 'ADMIN', undefined]) {
    assert.deepEqual(permissions({ ...allowed, actorUser: { role } }), denied);
  }
  for (const accountStatus of ['disabled', 'unknown', undefined]) {
    assert.deepEqual(permissions({ ...allowed, targetUser: { accountStatus } }), denied);
  }
  assert.deepEqual(permissions({ ...allowed, searchDiagnostics: null }), denied);
  assert.deepEqual(permissions({ ...allowed, searchDiagnostics: { ...diagnostics, ignoredUserResponseCount: '2' } }), denied);
  const neutral = { ...diagnostics, ignoredUserResponseCount: 0, malformedFileCount: 0, missingUsernameResponseCount: 0 };
  assert.deepEqual(permissions({ ...allowed, searchDiagnostics: neutral }), denied);
  assert.deepEqual(permissions({ ...allowed, searchDiagnostics: { ...neutral, ignoredUserResponseCount: 1 } }), { ...denied, canReviewIgnoredSources: true });
  assert.deepEqual(permissions({ ...allowed, searchDiagnostics: { ...neutral, missingUsernameResponseCount: 1 } }), { ...denied, canReviewProviderConnection: true });
});
