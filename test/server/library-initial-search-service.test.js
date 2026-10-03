import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryInitialSearchService } from '../../src/server/library/library-initial-search-service.js';

const now = new Date('2026-10-03T12:00:00Z');
function release() {
  return { id: 'wanted', wantedStatus: 'missing', missingTrackCount: 10, discoveryLinkExists: true, hasPriorDiscoveryCandidates: false,
    discoveryRequest: { searchMode: 'automatic', requestStatus: 'ready', blockedReason: null,
      searchAttemptCount: 0, researchAttemptCount: 0, evidence: {} } };
}
function createService(current, order, overrides = {}) {
  return createLibraryInitialSearchService({ withTransaction: (work) => work({ transaction: true }), getNow: () => now,
    assertMaintenanceWriteAllowed: async () => order.push('maintenance'), lockAppUserEligibilityFn: async () => order.push('account'),
    getAppUserById: async () => ({ isDisabled: false }), listWantedReleasesWithMetadata: async () => [current],
    ownedReleaseStore: { lockOwnedWantedRelease: async () => { order.push('owned'); return true; } },
    initialSearchStore: { recordInitialSearchIntent: async () => { order.push('save'); return true; } },
    recordAuditEventFn: async (_event, queryable) => { assert.equal(queryable.transaction, true); order.push('audit'); }, ...overrides });
}
const args = { appUserId: 'owner', metadataReleaseId: 'release', wantedReleaseId: 'wanted', requestedByUserId: 'actor' };

test('initial intent rechecks current state under ordered locks and commits its required audit', async () => {
  const order = [];
  const current = release();
  const before = structuredClone(current);
  assert.deepEqual(await createService(current, order).requestInitialMusicSearch(args), { intentAlreadyRecorded: false, searchAlreadyQueued: true });
  assert.deepEqual(order, ['maintenance', 'account', 'owned', 'save', 'audit']);
  assert.deepEqual(current, before);
});

test('existing target initial intent is a no-op after advancement and writes no duplicate audit', async () => {
  const order = [];
  const current = release();
  current.discoveryInitialSearch = { wantedReleaseId: 'wanted', requestedAt: now.toISOString() };
  current.discoveryRequest.requestStatus = 'cooldown';
  assert.deepEqual(await createService(current, order).requestInitialMusicSearch(args), { intentAlreadyRecorded: true, searchAlreadyQueued: false });
  assert.deepEqual(order, ['maintenance', 'account', 'owned']);
});

test('worker advancement, disabled target and missing owned link refuse saving an initial intent', async () => {
  for (const kind of ['worker', 'disabled', 'missing']) {
    const current = release();
    const order = [];
    const options = kind === 'disabled' ? { getAppUserById: async () => ({ isDisabled: true }) }
      : kind === 'missing' ? { ownedReleaseStore: { lockOwnedWantedRelease: async () => false } } : {};
    if (kind === 'worker') current.discoveryRequest.lastSearchAt = now.toISOString();
    await assert.rejects(createService(current, order, options).requestInitialMusicSearch(args));
    assert.equal(order.includes('save'), false);
  }
});
