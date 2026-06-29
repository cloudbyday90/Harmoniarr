import assert from 'node:assert/strict';
import test from 'node:test';
import { createAcquisitionPipelineService } from '../../src/server/acquisition/acquisition-pipeline-service.js';

const statusService = {
  deriveMusicQueueStatus: () => ({
    code: 'pick_match',
    label: 'Pick a match',
    tone: 'warning',
  }),
};

const stoppedStatusService = {
  deriveMusicQueueStatus: () => ({
    code: 'quality_choice_needed',
    label: 'Quality choice needed',
    nextAction: 'review_quality_choice',
    tone: 'warning',
  }),
};

const qualityPolicyService = {
  evaluateQualityEvidence: () => ({
    code: 'accepted',
    explanation: 'Quality accepted.',
    profile: { code: 'lossless_archive' },
  }),
};

function createRelease({ matchId = 'candidate-1', status = 'pending' } = {}) {
  return {
    artistName: 'Forest Frank',
    discoveryRequest: {
      importReviewSummary: {
        matches: [{
          fileCount: 12,
          matchId,
          score: 92,
          status,
        }],
        statusCounts: { [status]: 1 },
        totalCount: 1,
      },
    },
    expectedTrackCount: 12,
    id: 'wanted-1',
    metadataReleaseId: 'release-1',
    missingTrackCount: 12,
    releaseGroupTitle: 'Child of God',
    releaseGroupType: 'Album',
    releaseTitle: 'Child of God',
    wantedStatus: 'missing',
  };
}

function createService({
  requestMusicQueueRediscovery = async () => ({ metadataReleaseId: 'release-1', requestStatus: 'ready' }),
  release = createRelease(),
  rejectImportCandidate = async () => ({ toStatus: 'rejected' }),
  selectImportCandidate = async () => ({ toStatus: 'selected' }),
  startLibraryDiscoveryRun = async () => ({ accepted: true, run: { id: 'run-1' } }),
  statusService: serviceStatusService = statusService,
} = {}) {
  const store = {
    getWantedReleaseEvidence: async ({ appUserId, wantedReleaseId }) => (
      appUserId === 'user-1' && wantedReleaseId === 'wanted-1' ? release : null
    ),
    listWantedReleaseEvidence: async () => ({
      checkedAt: '2026-06-29T12:00:00.000Z',
      pagination: { limit: 100, offset: 0, total: 1 },
      releases: [release],
    }),
  };

  return createAcquisitionPipelineService({
    acquisitionPipelineStore: store,
    getNow: () => new Date('2026-06-29T12:00:00.000Z'),
    qualityPolicyService,
    requestMusicQueueRediscovery,
    rejectImportCandidate,
    selectImportCandidate,
    startLibraryDiscoveryRun,
    statusService: serviceStatusService,
  });
}

test('useMusicQueueMatch verifies release scope before selecting the underlying candidate', async (t) => {
  const selectImportCandidate = t.mock.fn(async ({ importCandidateId }) => ({ importCandidateId, toStatus: 'selected' }));
  const service = createService({ selectImportCandidate });

  const result = await service.useMusicQueueMatch({
    actorUserId: 'user-1',
    appUserId: 'user-1',
    matchId: 'candidate-1',
    requestMetadata: { ip: '127.0.0.1' },
    wantedReleaseId: 'wanted-1',
  });

  assert.equal(result.action.code, 'use_match');
  assert.equal(result.action.matchId, 'candidate-1');
  assert.equal(result.release.id, 'wanted-1');
  assert.deepEqual(selectImportCandidate.mock.calls[0].arguments, [{
    actorUserId: 'user-1',
    importCandidateId: 'candidate-1',
    reason: 'Selected from Music Queue',
    requestMetadata: { ip: '127.0.0.1' },
  }]);
});

test('rejectMusicQueueMatch verifies release scope before rejecting the underlying candidate', async (t) => {
  const rejectImportCandidate = t.mock.fn(async ({ importCandidateId }) => ({ importCandidateId, toStatus: 'rejected' }));
  const service = createService({ rejectImportCandidate });

  const result = await service.rejectMusicQueueMatch({
    actorUserId: 'user-1',
    appUserId: 'user-1',
    matchId: 'candidate-1',
    wantedReleaseId: 'wanted-1',
  });

  assert.equal(result.action.code, 'reject_match');
  assert.equal(result.action.matchId, 'candidate-1');
  assert.deepEqual(rejectImportCandidate.mock.calls[0].arguments, [{
    actorUserId: 'user-1',
    importCandidateId: 'candidate-1',
    reason: 'Rejected from Music Queue',
    requestMetadata: null,
  }]);
});

test('Music Queue match action hides matches outside the scoped release', async (t) => {
  const selectImportCandidate = t.mock.fn(async () => ({ toStatus: 'selected' }));
  const service = createService({ selectImportCandidate });

  await assert.rejects(
    () => service.useMusicQueueMatch({
      actorUserId: 'user-1',
      appUserId: 'user-1',
      matchId: 'candidate-outside-release',
      wantedReleaseId: 'wanted-1',
    }),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.code, 'music_queue_match_not_found');
      return true;
    },
  );
  assert.equal(selectImportCandidate.mock.callCount(), 0);
});

test('Music Queue match action hides releases outside the app user scope', async (t) => {
  const rejectImportCandidate = t.mock.fn(async () => ({ toStatus: 'rejected' }));
  const service = createService({ rejectImportCandidate });

  await assert.rejects(
    () => service.rejectMusicQueueMatch({
      actorUserId: 'user-2',
      appUserId: 'user-2',
      matchId: 'candidate-1',
      wantedReleaseId: 'wanted-1',
    }),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.code, 'music_queue_release_not_found');
      return true;
    },
  );
  assert.equal(rejectImportCandidate.mock.callCount(), 0);
});

test('requestMusicQueueReleaseRediscovery verifies release scope before queuing another search', async (t) => {
  const requestMusicQueueRediscovery = t.mock.fn(async () => ({
    metadataReleaseId: 'release-1',
    requestStatus: 'ready',
  }));
  const startLibraryDiscoveryRun = t.mock.fn(async () => ({ accepted: true, run: { id: 'run-1' } }));
  const service = createService({
    requestMusicQueueRediscovery,
    startLibraryDiscoveryRun,
    statusService: stoppedStatusService,
  });

  const result = await service.requestMusicQueueReleaseRediscovery({
    actorUserId: 'user-1',
    appUserId: 'user-1',
    requestMetadata: { ipAddress: '127.0.0.1' },
    wantedReleaseId: 'wanted-1',
  });

  assert.equal(result.action.code, 'search_again');
  assert.equal(result.action.discoveryRunId, 'run-1');
  assert.deepEqual(requestMusicQueueRediscovery.mock.calls[0].arguments, [{
    metadataReleaseId: 'release-1',
    reasonCode: 'quality_choice_search_again',
    requestedAt: '2026-06-29T12:00:00.000Z',
    requestedByUserId: 'user-1',
    wantedReleaseId: 'wanted-1',
  }]);
  assert.deepEqual(startLibraryDiscoveryRun.mock.calls[0].arguments, [{
    requestMetadata: { ipAddress: '127.0.0.1' },
    triggerSource: 'music_queue_try_again',
    triggeredByUserId: 'user-1',
  }]);
});

test('requestMusicQueueReleaseRediscovery succeeds when discovery dispatch is already active', async () => {
  const service = createService({
    startLibraryDiscoveryRun: async () => {
      const error = new Error('Discovery is already running');
      error.code = 'library_discovery_in_progress';
      throw error;
    },
    statusService: stoppedStatusService,
  });

  const result = await service.requestMusicQueueReleaseRediscovery({
    actorUserId: 'user-1',
    appUserId: 'user-1',
    wantedReleaseId: 'wanted-1',
  });

  assert.equal(result.action.dispatchAlreadyActive, true);
  assert.equal(result.action.discoveryRunId, null);
});

test('requestMusicQueueReleaseRediscovery rejects unstopped releases before writing', async (t) => {
  const requestMusicQueueRediscovery = t.mock.fn(async () => ({}));
  const service = createService({ requestMusicQueueRediscovery });

  await assert.rejects(
    () => service.requestMusicQueueReleaseRediscovery({
      actorUserId: 'user-1',
      appUserId: 'user-1',
      wantedReleaseId: 'wanted-1',
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'music_queue_retry_not_available');
      return true;
    },
  );
  assert.equal(requestMusicQueueRediscovery.mock.callCount(), 0);
});
