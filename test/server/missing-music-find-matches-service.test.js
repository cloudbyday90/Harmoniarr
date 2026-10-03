import assert from 'node:assert/strict';
import test from 'node:test';
import { createMissingMusicFindMatchesService } from '../../src/server/missing-music/missing-music-find-matches-service.js';

function createService(overrides = {}) {
  return createMissingMusicFindMatchesService({ resolveMissingMusicDecisionTarget: async () => ({ decisionId: 'wanted',
    targetUser: { id: 'recipient', isDisabled: false }, release: { metadataReleaseId: 'release' } }),
    requestInitialMusicSearch: async () => ({ intentAlreadyRecorded: false, searchAlreadyQueued: true }),
    startLibraryDiscoveryRun: async () => ({ run: { id: 'run', privateBody: 'private' } }), ...overrides });
}

test('Find matches keeps actor and target separate and reports the existing ready queue', async (t) => {
  const save = t.mock.fn(async () => ({ intentAlreadyRecorded: false, searchAlreadyQueued: true }));
  const result = await createService({ requestInitialMusicSearch: save }).findMissingMusicDecisionMatches({ actorUser: { id: 'admin' }, decisionId: 'wanted' });
  assert.deepEqual(save.mock.calls[0].arguments[0], { appUserId: 'recipient', metadataReleaseId: 'release', wantedReleaseId: 'wanted', requestedByUserId: 'admin', requestMetadata: null });
  assert.deepEqual(result.action, { code: 'find_matches', decisionId: 'wanted', targetUserId: 'recipient', searchPreparationStarted: true,
    searchAlreadyQueued: true, intentAlreadyRecorded: false, dispatchAlreadyActive: false, discoveryRunId: 'run' });
});

test('Find matches preserves historical no-op and never redispatches an already recorded intent', async (t) => {
  const dispatch = t.mock.fn(async () => {});
  const result = await createService({ requestInitialMusicSearch: async () => ({ intentAlreadyRecorded: true, searchAlreadyQueued: false }),
    startLibraryDiscoveryRun: dispatch }).findMissingMusicDecisionMatches({ actorUser: { id: 'admin' }, decisionId: 'wanted' });
  assert.equal(result.action.searchPreparationStarted, false);
  assert.equal(result.action.intentAlreadyRecorded, true);
  assert.equal(result.action.searchAlreadyQueued, false);
  assert.equal(dispatch.mock.callCount(), 0);
});

test('committed initial intent survives dispatch failure and coalesces an existing active dispatcher', async () => {
  for (const code of ['library_discovery_in_progress', 'controlled_dispatch_failure']) {
    const result = await createService({ startLibraryDiscoveryRun: async () => { throw Object.assign(new Error('Controlled dispatch failure'), { code }); } })
      .findMissingMusicDecisionMatches({ actorUser: { id: 'admin' }, decisionId: 'wanted' });
    assert.equal(result.action.searchPreparationStarted, true);
    assert.equal(result.action.dispatchAlreadyActive, code === 'library_discovery_in_progress');
    assert.equal(result.action.discoveryRunId, null);
  }
});
