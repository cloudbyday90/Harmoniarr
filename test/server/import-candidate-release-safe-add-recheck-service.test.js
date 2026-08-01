import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateReleaseSafeAddRecheckService } from '../../src/server/import-candidates/import-candidate-release-safe-add-recheck-service.js';

function createCandidate() {
  return {
    id: 'candidate-1',
    normalizedPayload: { musicQueue: { profileCode: 'lossless_archive' } },
    status: 'failed',
  };
}

function createService({
  findLatestReleaseAddRecoveryCandidate = async () => ({
    addBlockerCode: 'source_path_unavailable',
    importCandidateId: 'candidate-1',
    recoveryReasonCode: null,
  }),
  getImportCandidate = async () => createCandidate(),
  getMediaToolingStatus = async () => ({ status: 'healthy' }),
  previewImportCandidateApply = async () => ({ summary: { status: 'ready' } }),
  qualityGate = { eligible: true },
  resumeImportCandidateForSafeAdd = async () => ({ candidate: { id: 'candidate-1', status: 'import_pending' } }),
  startImportCandidateApplyRun = async () => ({ run: { id: 'run-1' } }),
} = {}) {
  return createImportCandidateReleaseSafeAddRecheckService({
    findLatestReleaseAddRecoveryCandidate,
    getImportCandidate,
    getMediaToolingStatus,
    previewImportCandidateApply,
    resumeImportCandidateForSafeAdd,
    safeAutoAddQualityGateService: {
      evaluateSafeAutoAddQuality: async () => qualityGate,
    },
    startImportCandidateApplyRun,
  });
}

test('recheckReleaseSafeAdd previews, re-gates, and queues only the release candidate', async (t) => {
  const findLatestReleaseAddRecoveryCandidate = t.mock.fn(async () => ({
    addBlockerCode: 'source_path_unavailable',
    importCandidateId: 'candidate-1',
    recoveryReasonCode: null,
  }));
  const previewImportCandidateApply = t.mock.fn(async () => ({ summary: { status: 'ready' } }));
  const resumeImportCandidateForSafeAdd = t.mock.fn(async () => ({ candidate: createCandidate() }));
  const startImportCandidateApplyRun = t.mock.fn(async () => ({ run: { id: 'run-1' } }));
  const service = createService({
    findLatestReleaseAddRecoveryCandidate,
    previewImportCandidateApply,
    resumeImportCandidateForSafeAdd,
    startImportCandidateApplyRun,
  });

  const result = await service.recheckReleaseSafeAdd({
    actorUserId: 'user-1',
    appUserId: 'user-1',
    requestMetadata: { ipAddress: '127.0.0.1' },
    wantedReleaseId: 'wanted-1',
  });

  assert.deepEqual(result, { outcome: 'queued', runId: 'run-1' });
  assert.deepEqual(findLatestReleaseAddRecoveryCandidate.mock.calls[0].arguments, [{
    appUserId: 'user-1',
    wantedReleaseId: 'wanted-1',
  }]);
  assert.deepEqual(previewImportCandidateApply.mock.calls[0].arguments, [{
    importCandidateId: 'candidate-1',
  }]);
  assert.deepEqual(resumeImportCandidateForSafeAdd.mock.calls[0].arguments, [{
    actorUserId: 'user-1',
    importCandidateId: 'candidate-1',
    reason: 'Automatic library add resumed after prerequisite repair',
    requestMetadata: { ipAddress: '127.0.0.1' },
  }]);
  assert.deepEqual(startImportCandidateApplyRun.mock.calls[0].arguments, [{
    applySafetyMode: 'safe_auto',
    importCandidateIds: ['candidate-1'],
    requestMetadata: { ipAddress: '127.0.0.1' },
    triggeredByUserId: 'user-1',
    triggerSource: 'music_queue_prerequisite_recheck',
  }]);
});

test('recheckReleaseSafeAdd refuses collision and quality-stop recovery without changing candidate state', async (t) => {
  const getImportCandidate = t.mock.fn(async () => createCandidate());
  const resumeImportCandidateForSafeAdd = t.mock.fn(async () => ({ candidate: createCandidate() }));
  const startImportCandidateApplyRun = t.mock.fn(async () => ({ run: { id: 'run-1' } }));
  const service = createService({
    findLatestReleaseAddRecoveryCandidate: async () => ({
      addBlockerCode: 'library_collision',
      importCandidateId: 'candidate-1',
      recoveryReasonCode: 'library_collision',
    }),
    getImportCandidate,
    resumeImportCandidateForSafeAdd,
    startImportCandidateApplyRun,
  });

  const result = await service.recheckReleaseSafeAdd({ appUserId: 'user-1', wantedReleaseId: 'wanted-1' });

  assert.deepEqual(result, { outcome: 'not_available' });
  assert.equal(getImportCandidate.mock.callCount(), 0);
  assert.equal(resumeImportCandidateForSafeAdd.mock.callCount(), 0);
  assert.equal(startImportCandidateApplyRun.mock.callCount(), 0);
});

test('recheckReleaseSafeAdd does not reopen a release when media tools remain unavailable', async (t) => {
  const resumeImportCandidateForSafeAdd = t.mock.fn(async () => ({ candidate: createCandidate() }));
  const startImportCandidateApplyRun = t.mock.fn(async () => ({ run: { id: 'run-1' } }));
  const service = createService({
    getMediaToolingStatus: async () => ({ status: 'degraded' }),
    findLatestReleaseAddRecoveryCandidate: async () => ({
      addBlockerCode: 'media_verification',
      importCandidateId: 'candidate-1',
      recoveryReasonCode: 'audio_check_failed',
    }),
    resumeImportCandidateForSafeAdd,
    startImportCandidateApplyRun,
  });

  const result = await service.recheckReleaseSafeAdd({ appUserId: 'user-1', wantedReleaseId: 'wanted-1' });

  assert.deepEqual(result, { outcome: 'prerequisite_not_ready' });
  assert.equal(resumeImportCandidateForSafeAdd.mock.callCount(), 0);
  assert.equal(startImportCandidateApplyRun.mock.callCount(), 0);
});

test('recheckReleaseSafeAdd keeps the candidate failed when preview or quality is not safe', async (t) => {
  const resumeImportCandidateForSafeAdd = t.mock.fn(async () => ({ candidate: createCandidate() }));
  const startImportCandidateApplyRun = t.mock.fn(async () => ({ run: { id: 'run-1' } }));
  const service = createService({
    qualityGate: { eligible: false },
    resumeImportCandidateForSafeAdd,
    startImportCandidateApplyRun,
  });

  const result = await service.recheckReleaseSafeAdd({ appUserId: 'user-1', wantedReleaseId: 'wanted-1' });

  assert.deepEqual(result, { outcome: 'still_needs_review' });
  assert.equal(resumeImportCandidateForSafeAdd.mock.callCount(), 0);
  assert.equal(startImportCandidateApplyRun.mock.callCount(), 0);
});
