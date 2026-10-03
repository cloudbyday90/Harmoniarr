import assert from 'node:assert/strict';
import test from 'node:test';
import { createMissingMusicLibraryAddService } from '../../src/server/missing-music/missing-music-library-add-service.js';

test('canonical add resolves recipient authority and allowlists all outcomes without exposing internal evidence', async () => {
  for (const outcome of ['queued', 'already_queued', 'still_needs_review', 'not_available', 'deferred', 'untrusted']) {
    let input;
    const service = createMissingMusicLibraryAddService({ resolveMissingMusicDecisionTarget: async () => ({
      decisionId: 'wanted-1', release: { id: 'wanted-1' }, targetUser: { id: 'recipient-1' } }),
    startReleaseManualSafeAdd: async (value) => { input = value; return { outcome, runId: 'run-1', sourcePath: '/private' }; } });
    const result = await service.addMissingMusicDecisionToLibrary({ actorUser: { id: 'admin-1' }, decisionId: 'wanted-1' });
    assert.deepEqual(input, { actorUserId: 'admin-1', appUserId: 'recipient-1', wantedReleaseId: 'wanted-1', requestMetadata: null });
    assert.deepEqual(result, { action: { code: 'add_to_library', decisionId: 'wanted-1', targetUserId: 'recipient-1',
      outcome: outcome === 'untrusted' ? 'not_available' : outcome, runId: ['queued', 'already_queued'].includes(outcome) ? 'run-1' : null } });
  }
});
test('disabled history refuses before delegation and missing wiring fails clearly', async () => {
  const service = createMissingMusicLibraryAddService({ resolveMissingMusicDecisionTarget: async () => ({ targetUser: { isDisabled: true } }),
    startReleaseManualSafeAdd: async () => assert.fail('disabled history must not mutate') });
  await assert.rejects(service.addMissingMusicDecisionToLibrary({ actorUser: { id: 'admin-1' } }), { code: 'missing_music_decision_read_only' });
  assert.throws(() => createMissingMusicLibraryAddService(), /requires resolveMissingMusicDecisionTarget/u);
});
