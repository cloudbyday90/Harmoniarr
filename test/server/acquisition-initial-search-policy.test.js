import assert from 'node:assert/strict';
import test from 'node:test';
import { canFindInitialMusicMatches, hasRecordedInitialSearchIntent } from '../../src/server/acquisition/acquisition-initial-search-policy.js';
import { projectMusicQueueRelease } from '../../src/server/acquisition/acquisition-pipeline-service.js';

const now = new Date('2026-10-03T12:00:00Z');
function release(overrides = {}) {
  return { id: 'wanted', wantedStatus: 'missing', missingTrackCount: 10, discoveryLinkExists: true, hasPriorDiscoveryCandidates: false,
    releaseDate: '2026-09-01', discoveryRequest: { searchMode: 'automatic', requestStatus: 'ready', blockedReason: null,
      searchAttemptCount: 0, researchAttemptCount: 0, lastSearchAt: null, nextSearchAfter: null, evidence: {} }, ...overrides };
}
const eligible = (value) => canFindInitialMusicMatches({ release: value, targetUser: { isDisabled: false }, now,
  projectedRelease: projectMusicQueueRelease(value) });

test('initial search is available only for an authoritative due untouched linked request', () => {
  assert.equal(eligible(release()), true);
  for (const values of [{ discoveryLinkExists: false }, { hasPriorDiscoveryCandidates: true }, { hasPriorDiscoveryCandidates: undefined },
    { releaseDate: '2027-01-01' }, { releaseDate: 'bad' }, { wantedStatus: 'ignored' }, { missingTrackCount: 0 },
    { discoveryInitialSearch: { wantedReleaseId: 'wanted', requestedAt: now.toISOString() } }]) assert.equal(eligible(release(values)), false);
  for (const values of [{ searchMode: 'manual' }, { requestStatus: 'cooldown' }, { requestStatus: 'blocked' }, { blockedReason: 'release_date_pending' },
    { searchAttemptCount: 1 }, { researchAttemptCount: 1 }, { lastSearchAt: now.toISOString() }, { nextSearchAfter: '2027-01-01' },
    { nextSearchAfter: 'bad' }, { manualRequestedAt: now.toISOString() }]) {
    const current = release(); Object.assign(current.discoveryRequest, values); assert.equal(eligible(current), false);
  }
  assert.equal(canFindInitialMusicMatches({ release: release(), targetUser: { isDisabled: true }, now }), false);
});

test('initial permission refuses prior results, failures, retry and active candidate evidence even when counters were reset', () => {
  for (const key of ['lastSearchId', 'lastSearchResult', 'lastDispatchFailure', 'lastDispatchAttemptedAt', 'musicQueueRediscovery', 'downloadRecoveryRediscovery']) {
    const current = release(); current.discoveryRequest.evidence[key] = {}; assert.equal(eligible(current), false);
  }
  const current = release(); current.discoveryRequest.importReviewSummary = { totalCount: 1, statusCounts: { selected: 1 } };
  assert.equal(eligible(current), false);
  assert.equal(hasRecordedInitialSearchIntent(release({ discoveryInitialSearch: { wantedReleaseId: 'other', requestedAt: now.toISOString() } })), false);
});
