import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryFallbackQualityService } from '../../src/server/library/library-fallback-quality-service.js';

function fixture(t, overrides = {}) {
  const queryable = {};
  const calls = [];
  const allowMusicQueueFallbackQuality = t.mock.fn(async ({ queryable: client }) => { assert.equal(client, queryable); calls.push('save'); return { requestStatus: 'ready' }; });
  const recordAuditEventFn = t.mock.fn(async (_event, client) => { assert.equal(client, queryable); calls.push('audit'); });
  const service = createLibraryFallbackQualityService({ allowMusicQueueFallbackQuality,
    assertMaintenanceWriteAllowed: async () => { calls.push('maintenance'); },
    lockAppUserEligibilityFn: async () => { calls.push('account'); }, getAppUserById: async () => ({ isDisabled: false }),
    ownedReleaseStore: { lockOwnedWantedRelease: async () => { calls.push('owned'); return true; } },
    listWantedReleasesWithMetadata: async () => [{ id: 'wanted' }],
    projectMusicQueueReleaseFn: () => ({ status: { code: 'quality_choice_needed' }, evidence: { search: { searchMode: 'automatic', status: 'cooldown' } }, quality: { code: 'below_minimum', profile: { code: 'lossless_archive' } } }),
    recordAuditEventFn, withTransaction: async (work) => { const result = await work(queryable); calls.push('commit'); return result; }, ...overrides });
  return { calls, allowMusicQueueFallbackQuality, recordAuditEventFn, service,
    intent: { appUserId: 'recipient', wantedReleaseId: 'wanted', metadataReleaseId: 'release', allowedAt: '2026-10-03T12:00:00.000Z', allowedByUserId: 'admin' } };
}

test('fallback commits only the selected target consent after current maintenance, eligibility and owned locks', async (t) => {
  const context = fixture(t);
  assert.equal((await context.service.allowGuardedMusicQueueFallbackQuality(context.intent)).overrideAlreadyAllowed, false);
  assert.deepEqual(context.calls, ['maintenance', 'account', 'owned', 'save', 'audit', 'commit']);
  assert.equal(context.recordAuditEventFn.mock.calls[0].arguments[0].details.requestedForUserId, 'recipient');
  assert.equal(context.recordAuditEventFn.mock.calls[0].arguments[0].actorUserId, 'admin');
});

test('existing target consent is a no-op even after the current state advances', async (t) => {
  const context = fixture(t, { listWantedReleasesWithMetadata: async () => [{ discoveryQualityOverride: { mode: 'allow_fallback_quality', wantedReleaseId: 'wanted' },
    discoveryRequest: { searchMode: 'automatic', requestStatus: 'ready', evidence: { musicQueueRediscovery: {} } } }],
    projectMusicQueueReleaseFn: () => { throw new Error('No repeated state mutation'); } });
  const result = await context.service.allowGuardedMusicQueueFallbackQuality(context.intent);
  assert.equal(result.overrideAlreadyAllowed, true);
  assert.equal(result.restartAlreadyQueued, true);
  assert.equal(context.allowMusicQueueFallbackQuality.mock.callCount(), 0);
  assert.equal(context.recordAuditEventFn.mock.callCount(), 0);
});

test('fallback rejects disabled, missing-link, verification and advanced handoff states before saving', async (t) => {
  for (const overrides of [{ getAppUserById: async () => ({ isDisabled: true }) },
    { ownedReleaseStore: { lockOwnedWantedRelease: async () => false } },
    { projectMusicQueueReleaseFn: () => ({ status: { code: 'downloading' }, quality: { code: 'below_minimum', profile: { code: 'lossless_archive' } } }) },
    { projectMusicQueueReleaseFn: () => ({ status: { code: 'quality_choice_needed' }, quality: { code: 'needs_verification', profile: { code: 'lossless_archive' } } }) }]) {
    const context = fixture(t, overrides);
    await assert.rejects(() => context.service.allowGuardedMusicQueueFallbackQuality(context.intent));
    assert.equal(context.allowMusicQueueFallbackQuality.mock.callCount(), 0);
    assert.equal(context.recordAuditEventFn.mock.callCount(), 0);
  }
});
