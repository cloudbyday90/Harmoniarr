import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createLibraryMusicQueueRediscoveryService } from '../../src/server/library/library-music-queue-rediscovery-service.js';

function fixture(t, overrides = {}) {
  const calls = [];
  const queryable = {};
  const recordAuditEventFn = t.mock.fn(async (_event, client) => { assert.equal(client, queryable); calls.push('audit'); });
  const requestMusicQueueRediscovery = t.mock.fn(async ({ queryable: client }) => {
    assert.equal(client, queryable); calls.push('reset'); return { restartDisposition: 'started', discoveryRequest: {} };
  });
  const service = createLibraryMusicQueueRediscoveryService({
    assertMaintenanceWriteAllowed: async ({ queryable: client }) => { assert.equal(client, queryable); calls.push('maintenance'); },
    lockAppUserEligibilityFn: async ({ userIds, queryable: client }) => { assert.deepEqual(userIds, ['recipient']); assert.equal(client, queryable); calls.push('account-lock'); },
    getAppUserById: async () => { calls.push('account-read'); return { id: 'recipient', isDisabled: false }; },
    listWantedReleasesWithMetadata: async () => [{ id: 'wanted' }],
    projectMusicQueueReleaseFn: () => ({ status: { code: 'failed' } }),
    rediscoveryStore: { lockOwnedWantedRelease: async () => { calls.push('owned-lock'); return true; }, recordCoalescedTargetIntent: async () => false },
    requestMusicQueueRediscovery, recordAuditEventFn,
    withTransaction: async (work) => { const result = await work(queryable); calls.push('commit'); return result; },
    ...overrides,
  });
  const intent = { appUserId: 'recipient', metadataReleaseId: 'release', wantedReleaseId: 'wanted',
    requestedAt: '2026-10-03T12:00:00.000Z', requestedByUserId: 'admin', reasonCode: 'music_queue_try_again' };
  return { calls, intent, queryable, recordAuditEventFn, requestMusicQueueRediscovery, service };
}

test('guarded rediscovery locks maintenance, account eligibility, and owned intent before resetting and auditing', async (t) => {
  const context = fixture(t);
  const result = await context.service.requestGuardedMusicQueueRediscovery(context.intent);
  assert.equal(result.restartDisposition, 'started');
  assert.deepEqual(context.calls, ['maintenance', 'account-lock', 'account-read', 'owned-lock', 'reset', 'audit', 'commit']);
  assert.equal(context.recordAuditEventFn.mock.calls[0].arguments[0].actorUserId, 'admin');
  assert.equal(context.recordAuditEventFn.mock.calls[0].arguments[0].details.requestedForUserId, 'recipient');
});

test('guarded rediscovery prevents writes after maintenance, account, ownership, or release state changes', async (t) => {
  for (const overrides of [
    { assertMaintenanceWriteAllowed: async () => { throw createApiError(409, 'recovery_lock_conflict', 'Locked'); } },
    { getAppUserById: async () => ({ isDisabled: true }) },
    { rediscoveryStore: { lockOwnedWantedRelease: async () => false, recordCoalescedTargetIntent: async () => false } },
    { projectMusicQueueReleaseFn: () => ({ status: { code: 'downloading' } }) },
  ]) {
    const context = fixture(t, overrides);
    await assert.rejects(() => context.service.requestGuardedMusicQueueRediscovery(context.intent));
    assert.equal(context.requestMusicQueueRediscovery.mock.callCount(), 0);
    assert.equal(context.recordAuditEventFn.mock.callCount(), 0);
  }
});

test('coalesced retry intent belongs to the current shared cycle and does not duplicate its audit', async (t) => {
  const requestedAt = '2026-10-03T11:00:00+00:00';
  const recordCoalescedTargetIntent = t.mock.fn(async () => false);
  const context = fixture(t, {
    listWantedReleasesWithMetadata: async () => [{ discoveryRequest: { searchMode: 'automatic', requestStatus: 'ready', evidence: { musicQueueRediscovery: {} } } }],
    projectMusicQueueReleaseFn: () => ({ status: { code: 'queued_for_search' } }),
    rediscoveryStore: { lockOwnedWantedRelease: async () => true, recordCoalescedTargetIntent },
    requestMusicQueueRediscovery: async () => ({ restartDisposition: 'already_queued', discoveryRequest: { evidence: { musicQueueRediscovery: { requestedAt } } } }),
  });
  assert.equal((await context.service.requestGuardedMusicQueueRediscovery(context.intent)).restartDisposition, 'already_queued');
  assert.equal(recordCoalescedTargetIntent.mock.calls[0].arguments[0].requestedAt, requestedAt);
  assert.equal(context.recordAuditEventFn.mock.callCount(), 0);
});
