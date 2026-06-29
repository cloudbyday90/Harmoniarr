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
    missingTrackCount: 12,
    releaseGroupTitle: 'Child of God',
    releaseGroupType: 'Album',
    releaseTitle: 'Child of God',
    wantedStatus: 'missing',
  };
}

function createService({
  release = createRelease(),
  rejectImportCandidate = async () => ({ toStatus: 'rejected' }),
  selectImportCandidate = async () => ({ toStatus: 'selected' }),
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
    qualityPolicyService,
    rejectImportCandidate,
    selectImportCandidate,
    statusService,
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
