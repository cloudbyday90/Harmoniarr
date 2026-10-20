import assert from 'node:assert/strict';
import test from 'node:test';
import { projectMusicQueueRelease } from '../../src/server/acquisition/acquisition-pipeline-service.js';
import { createLibraryDiscoveryRequestService } from '../../src/server/library/library-discovery-request-service.js';
import { createLibraryDiscoveryDispatchService } from '../../src/server/library/library-discovery-dispatch-service.js';

for (const code of ['slskd_search_continuation_expired', 'slskd_search_continuation_unavailable']) {
  test(`${code} stops its claim without recording no-match success or scheduling continuation`, async () => {
    const claimedRequest = { artistName: 'Artist', releaseTitle: 'Album', metadataReleaseId: 'release' };
    let next = claimedRequest;
    const stopped = [];
    const service = createLibraryDiscoveryDispatchService({ loadSettingsFn: async () => ({}),
      slskdService: { startSearch: async () => assert.fail('Continuation owns search submission') },
      importCandidateService: { ingestSlskdSearchResponses: async () => assert.fail('Terminal continuation cannot ingest') },
      libraryDiscoverySearchService: { startSearch: async () => { throw Object.assign(new Error('Private provider details'), { code }); } },
      discoverySearchAuthorityStore: { assertClaimCurrent: async () => {},
        stopContinuation: async input => { stopped.push(input); return true; },
        deferContinuation: async () => assert.fail('A terminal continuation cannot be scheduled') },
      libraryDiscoveryRequestStore: { claimNextReadyAutomaticDiscoveryRequest: async () => { const current = next; next = null; return current; },
        recordDiscoverySearchFailure: async () => assert.fail('The stop must own the atomic failure'),
        recordDiscoverySearchSuccess: async () => assert.fail('Unavailable searches are not zero results') },
    });
    const result = await service.dispatchReadyDiscoveryRequests();
    assert.equal(result.failedCount, 1);
    assert.deepEqual(stopped, [{ claimedRequest, errorCode: code }]);
  });

  test(`${code} survives reconciliation and projects an actionable bounded failure`, async () => {
    let recorded;
    const service = createLibraryDiscoveryRequestService({ getNow: () => new Date('2026-10-20T15:00:00Z'),
      getPoolFn: () => ({ query: async () => ({ rows: [{ metadata_artist_id: 'artist', metadata_release_group_id: 'group',
        metadata_release_id: 'release', wanted_status: 'missing', search_mode: 'automatic', blocked_reason: code,
        last_search_at: '2026-10-19T12:00:00Z', search_attempt_count: 0, research_attempt_count: 0,
        prior_evidence: { lastDispatchFailure: { code, message: 'Private provider /mnt/data' } } }] }) }),
      libraryDiscoveryRequestStore: { replaceLibraryDiscoveryRequests: async input => { recorded = input.discoveryRequests[0]; } },
    });
    await service.reconcileDiscoveryRequests();
    assert.equal(recorded.requestStatus, 'blocked'); assert.equal(recorded.nextSearchAfter, null);
    assert.equal(recorded.searchAttemptCount, 0);
    const projection = projectMusicQueueRelease({ missingTrackCount: 5, wantedStatus: 'missing', discoveryRequest: recorded });
    assert.equal(projection.status.code, 'failed'); assert.equal(projection.status.nextAction, 'try_again');
    assert.match(projection.status.message, /Choose Search again/);
    assert.doesNotMatch(JSON.stringify(projection), /Private provider|\/mnt\/data/);
    assert.equal(projectMusicQueueRelease({ missingTrackCount: 0, wantedStatus: 'complete', discoveryRequest: recorded }).status.code, 'in_library');
  });
}
