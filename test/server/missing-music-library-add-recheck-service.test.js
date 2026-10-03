import assert from 'node:assert/strict';
import test from 'node:test';
import { createMissingMusicLibraryAddRecheckService } from '../../src/server/missing-music/missing-music-library-add-recheck-service.js';
test('canonical recheck preserves actor versus recipient and bounds every public result', async () => {
  let input;
  const service = createMissingMusicLibraryAddRecheckService({
    resolveMissingMusicDecisionTarget: async () => ({ decisionId: 'decision-1', release: { id: 'wanted-1' }, targetUser: { id: 'recipient-1' } }),
    recheckReleaseSafeAdd: async (value) => { input = value; return { outcome: 'queued', runId: 'run-1', sourcePath: '/private' }; },
  });
  const result = await service.recheckMissingMusicDecisionLibraryAdd({ actorUser: { id: 'admin-1' }, decisionId: 'decision-1' });
  assert.equal(input.actorUserId, 'admin-1');
  assert.equal(input.appUserId, 'recipient-1');
  assert.deepEqual(result, { action: { code: 'recheck_library_add', decisionId: 'decision-1', targetUserId: 'recipient-1', outcome: 'queued', runId: 'run-1' } });
});
test('canonical recheck refuses disabled history before invoking its owning write', async () => {
  const service = createMissingMusicLibraryAddRecheckService({ resolveMissingMusicDecisionTarget: async () => ({ targetUser: { isDisabled: true } }),
    recheckReleaseSafeAdd: async () => assert.fail('disabled history must not write') });
  await assert.rejects(service.recheckMissingMusicDecisionLibraryAdd({ actorUser: { id: 'admin-1' }, decisionId: 'decision-1' }), { code: 'missing_music_decision_read_only' });
});
