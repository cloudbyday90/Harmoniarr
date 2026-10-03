import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createMissingMusicSearchAgainService } from '../../src/server/missing-music/missing-music-search-again-service.js';
import { canSearchMissingMusicAgain } from '../../src/server/missing-music/missing-music-search-again-policy.js';

test('Search again permits only the existing stopped states on active target history', () => {
  for (const statusCode of ['failed', 'no_matches_left', 'quality_choice_needed']) {
    assert.equal(canSearchMissingMusicAgain({ statusCode, targetUser: { isDisabled: false } }), true);
    assert.equal(canSearchMissingMusicAgain({ statusCode, targetUser: { accountStatus: 'disabled' } }), false);
  }
  for (const statusCode of ['downloading', 'queued_for_search', 'pick_match', 'needs_setup', 'in_library', 'needs_help_adding']) {
    assert.equal(canSearchMissingMusicAgain({ statusCode, targetUser: {} }), false);
  }
});

test('Search again delegates the resolved recipient separately from the actor and returns fixed public facts', async (t) => {
  const actorUser = { id: 'admin', role: 'admin' };
  const requestMetadata = { ipAddress: '127.0.0.1' };
  const requestMusicQueueReleaseRediscovery = t.mock.fn(async () => ({
    action: { dispatchAlreadyActive: true, restartAlreadyQueued: false, discoveryRunId: 'run' },
    release: { sourcePath: 'must-not-leak' }, run: { errorMessage: 'must-not-leak' }, rediscovery: { private: 'must-not-leak' },
  }));
  const resolveMissingMusicDecisionTarget = t.mock.fn(async () => ({ decisionId: 'wanted', targetUser: { id: 'recipient', isDisabled: false } }));
  const service = createMissingMusicSearchAgainService({ requestMusicQueueReleaseRediscovery, resolveMissingMusicDecisionTarget });
  const result = await service.searchMissingMusicDecisionAgain({ actorUser, decisionId: 'wanted', requestMetadata });
  assert.deepEqual(resolveMissingMusicDecisionTarget.mock.calls[0].arguments[0], { actorUser, decisionId: 'wanted' });
  assert.deepEqual(requestMusicQueueReleaseRediscovery.mock.calls[0].arguments[0], {
    actorUserId: 'admin', appUserId: 'recipient', includeRelease: false, requestMetadata, wantedReleaseId: 'wanted',
  });
  assert.deepEqual(result, { action: { code: 'search_again', decisionId: 'wanted', targetUserId: 'recipient',
    searchPreparationStarted: true, restartAlreadyQueued: false, dispatchAlreadyActive: true, discoveryRunId: 'run' } });
  assert.doesNotMatch(JSON.stringify(result), /must-not-leak/);
});

test('Search again refuses disabled history and preserves unavailable-target errors before dispatch', async (t) => {
  const requestMusicQueueReleaseRediscovery = t.mock.fn(async () => ({}));
  const disabled = createMissingMusicSearchAgainService({ requestMusicQueueReleaseRediscovery,
    resolveMissingMusicDecisionTarget: async () => ({ targetUser: { isDisabled: true } }) });
  await assert.rejects(() => disabled.searchMissingMusicDecisionAgain({ actorUser: { id: 'admin' }, decisionId: 'wanted' }),
    { status: 409, code: 'missing_music_decision_read_only' });
  const unavailable = createMissingMusicSearchAgainService({ requestMusicQueueReleaseRediscovery,
    resolveMissingMusicDecisionTarget: async () => { throw createApiError(404, 'missing_music_decision_not_found', 'Not found'); } });
  await assert.rejects(() => unavailable.searchMissingMusicDecisionAgain({}), { status: 404, code: 'missing_music_decision_not_found' });
  assert.equal(requestMusicQueueReleaseRediscovery.mock.callCount(), 0);
});

test('Search again fails clearly when the canonical command dependencies are missing', () => {
  assert.throws(() => createMissingMusicSearchAgainService(), /requires requestMusicQueueReleaseRediscovery/);
});
