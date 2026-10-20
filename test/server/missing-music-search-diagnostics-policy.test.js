import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMissingMusicSearchDiagnostics as build } from '../../src/server/missing-music/missing-music-search-diagnostics-policy.js';
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
