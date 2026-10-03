import assert from 'node:assert/strict';
import test from 'node:test';
import { createMissingMusicFallbackQualityService } from '../../src/server/missing-music/missing-music-fallback-quality-service.js';

test('canonical fallback separates the authenticated actor from the resolved target and emits only public action facts', async (t) => {
  const allowMusicQueueReleaseFallbackQuality = t.mock.fn(async () => ({ action: { overrideAlreadyAllowed: false, restartAlreadyQueued: true, discoveryRunId: 'run' },
    override: { privateProviderPath: '/private' } }));
  const service = createMissingMusicFallbackQualityService({ allowMusicQueueReleaseFallbackQuality,
    resolveMissingMusicDecisionTarget: async () => ({ decisionId: 'wanted', targetUser: { id: 'recipient', isDisabled: false } }) });
  const result = await service.allowMissingMusicDecisionFallbackQuality({ actorUser: { id: 'admin' }, decisionId: 'wanted' });
  assert.deepEqual(allowMusicQueueReleaseFallbackQuality.mock.calls[0].arguments[0], { actorUserId: 'admin', appUserId: 'recipient', includeRelease: false, requestMetadata: null, wantedReleaseId: 'wanted' });
  assert.deepEqual(result, { action: { code: 'allow_fallback_quality', decisionId: 'wanted', targetUserId: 'recipient', fallbackAllowed: true,
    searchPreparationStarted: true, overrideAlreadyAllowed: false, restartAlreadyQueued: true, dispatchAlreadyActive: false, discoveryRunId: 'run' } });
});

test('canonical fallback refuses disabled history before the acquisition write', async (t) => {
  const allowMusicQueueReleaseFallbackQuality = t.mock.fn(async () => ({}));
  const service = createMissingMusicFallbackQualityService({ allowMusicQueueReleaseFallbackQuality,
    resolveMissingMusicDecisionTarget: async () => ({ targetUser: { id: 'recipient', isDisabled: true } }) });
  await assert.rejects(() => service.allowMissingMusicDecisionFallbackQuality({ actorUser: { id: 'admin' }, decisionId: 'wanted' }), { code: 'missing_music_decision_read_only' });
  assert.equal(allowMusicQueueReleaseFallbackQuality.mock.callCount(), 0);
});

test('existing consent without queued work does not report new search preparation', async () => {
  const service = createMissingMusicFallbackQualityService({ allowMusicQueueReleaseFallbackQuality: async () => ({
    action: { overrideAlreadyAllowed: true, restartAlreadyQueued: false } }),
    resolveMissingMusicDecisionTarget: async () => ({ decisionId: 'wanted', targetUser: { id: 'recipient' } }) });
  const result = await service.allowMissingMusicDecisionFallbackQuality({ actorUser: { id: 'admin' }, decisionId: 'wanted' });
  assert.equal(result.action.fallbackAllowed, true);
  assert.equal(result.action.overrideAlreadyAllowed, true);
  assert.equal(result.action.searchPreparationStarted, false);
});
