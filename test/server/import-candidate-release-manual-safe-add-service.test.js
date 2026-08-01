import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateReleaseManualSafeAddService } from '../../src/server/import-candidates/import-candidate-release-manual-safe-add-service.js';

function createCandidate({
  musicQueue = { wantedReleaseId: 'wanted-1' },
  musicQueueContext = null,
  status = 'import_pending',
} = {}) {
  return {
    id: 'candidate-1',
    normalizedPayload: {
      ...(musicQueue ? { musicQueue } : {}),
      ...(musicQueueContext ? { musicQueueContext } : {}),
    },
    status,
  };
}

function createService({
  candidate = createCandidate(),
  preview = { summary: { status: 'ready' } },
  qualityGate = { eligible: true },
  startImportCandidateApplyRun = async () => ({ run: { id: 'apply-run-1' } }),
} = {}) {
  return createImportCandidateReleaseManualSafeAddService({
    getImportCandidate: async () => candidate,
    previewImportCandidateApply: async () => preview,
    safeAutoAddQualityGateService: {
      evaluateSafeAutoAddQuality: async () => qualityGate,
    },
    startImportCandidateApplyRun,
  });
}

test('startReleaseManualSafeAdd regenerates a safe plan and queues only the scoped release candidate', async (t) => {
  const getImportCandidate = t.mock.fn(async () => createCandidate());
  const previewImportCandidateApply = t.mock.fn(async () => ({ summary: { status: 'ready' } }));
  const evaluateSafeAutoAddQuality = t.mock.fn(async () => ({ eligible: true }));
  const startImportCandidateApplyRun = t.mock.fn(async () => ({ run: { id: 'apply-run-1' } }));
  const service = createImportCandidateReleaseManualSafeAddService({
    getImportCandidate,
    previewImportCandidateApply,
    safeAutoAddQualityGateService: { evaluateSafeAutoAddQuality },
    startImportCandidateApplyRun,
  });

  const result = await service.startReleaseManualSafeAdd({
    actorUserId: 'user-1',
    appUserId: 'user-1',
    importCandidateId: 'candidate-1',
    requestMetadata: { ipAddress: '127.0.0.1' },
    wantedReleaseId: 'wanted-1',
  });

  assert.deepEqual(result, { outcome: 'queued', runId: 'apply-run-1' });
  assert.deepEqual(getImportCandidate.mock.calls[0].arguments, [{ importCandidateId: 'candidate-1' }]);
  assert.deepEqual(previewImportCandidateApply.mock.calls[0].arguments, [{ importCandidateId: 'candidate-1' }]);
  assert.equal(evaluateSafeAutoAddQuality.mock.callCount(), 1);
  assert.deepEqual(startImportCandidateApplyRun.mock.calls[0].arguments, [{
    applySafetyMode: 'safe_auto',
    importCandidateIds: ['candidate-1'],
    requestMetadata: { ipAddress: '127.0.0.1' },
    triggeredByUserId: 'user-1',
    triggerSource: 'music_queue_manual_add',
  }]);
});

test('startReleaseManualSafeAdd accepts the persisted legacy Music Queue release context', async (t) => {
  const startImportCandidateApplyRun = t.mock.fn(async () => ({ run: { id: 'apply-run-1' } }));
  const service = createService({
    candidate: createCandidate({
      musicQueue: null,
      musicQueueContext: { wantedReleaseIds: ['wanted-1'] },
    }),
    startImportCandidateApplyRun,
  });

  const result = await service.startReleaseManualSafeAdd({
    appUserId: 'user-1',
    importCandidateId: 'candidate-1',
    wantedReleaseId: 'wanted-1',
  });

  assert.deepEqual(result, { outcome: 'queued', runId: 'apply-run-1' });
  assert.equal(startImportCandidateApplyRun.mock.callCount(), 1);
});

test('startReleaseManualSafeAdd rejects a stale, mismatched, or non-pending candidate before previewing', async (t) => {
  const previewImportCandidateApply = t.mock.fn(async () => ({ summary: { status: 'ready' } }));
  const startImportCandidateApplyRun = t.mock.fn(async () => ({ run: { id: 'apply-run-1' } }));
  const service = createService({
    candidate: createCandidate({ musicQueue: { wantedReleaseId: 'wanted-elsewhere' } }),
    startImportCandidateApplyRun,
  });
  const mismatched = await service.startReleaseManualSafeAdd({
    appUserId: 'user-1',
    importCandidateId: 'candidate-1',
    wantedReleaseId: 'wanted-1',
  });

  assert.deepEqual(mismatched, { outcome: 'not_available' });
  assert.equal(startImportCandidateApplyRun.mock.callCount(), 0);

  const notPending = createImportCandidateReleaseManualSafeAddService({
    getImportCandidate: async () => createCandidate({ status: 'failed' }),
    previewImportCandidateApply,
    safeAutoAddQualityGateService: { evaluateSafeAutoAddQuality: async () => ({ eligible: true }) },
    startImportCandidateApplyRun,
  });
  const result = await notPending.startReleaseManualSafeAdd({
    appUserId: 'user-1',
    importCandidateId: 'candidate-1',
    wantedReleaseId: 'wanted-1',
  });

  assert.deepEqual(result, { outcome: 'not_available' });
  assert.equal(previewImportCandidateApply.mock.callCount(), 0);
  assert.equal(startImportCandidateApplyRun.mock.callCount(), 0);
});

test('startReleaseManualSafeAdd keeps blocked previews and strict quality failures out of the apply queue', async (t) => {
  const startImportCandidateApplyRun = t.mock.fn(async () => ({ run: { id: 'apply-run-1' } }));
  const blockedPreview = createService({
    preview: { summary: { status: 'blocked' } },
    startImportCandidateApplyRun,
  });
  const previewResult = await blockedPreview.startReleaseManualSafeAdd({
    appUserId: 'user-1',
    importCandidateId: 'candidate-1',
    wantedReleaseId: 'wanted-1',
  });

  assert.deepEqual(previewResult, { outcome: 'still_needs_review' });

  const blockedQuality = createService({
    qualityGate: { eligible: false },
    startImportCandidateApplyRun,
  });
  const qualityResult = await blockedQuality.startReleaseManualSafeAdd({
    appUserId: 'user-1',
    importCandidateId: 'candidate-1',
    wantedReleaseId: 'wanted-1',
  });

  assert.deepEqual(qualityResult, { outcome: 'still_needs_review' });
  assert.equal(startImportCandidateApplyRun.mock.callCount(), 0);
});

test('startReleaseManualSafeAdd returns a bounded deferred outcome for a current apply run', async () => {
  const error = new Error('Apply already active');
  error.code = 'import_candidate_apply_in_progress';
  const service = createService({
    startImportCandidateApplyRun: async () => {
      throw error;
    },
  });

  const result = await service.startReleaseManualSafeAdd({
    appUserId: 'user-1',
    importCandidateId: 'candidate-1',
    wantedReleaseId: 'wanted-1',
  });

  assert.deepEqual(result, { outcome: 'deferred' });
});
