import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createImportCandidateAutoApplyRunService } from '../../src/server/import-candidates/import-candidate-auto-apply-run-service.js';

test('startSafeApplyRunAfterDownloadCompleted starts a safe-auto apply run', async (t) => {
  const startImportCandidateApplyRun = t.mock.fn(async () => ({
    accepted: true,
    run: { id: 'apply-run-1' },
  }));
  const service = createImportCandidateAutoApplyRunService({
    startImportCandidateApplyRun,
  });

  const result = await service.startSafeApplyRunAfterDownloadCompleted({
    importCandidateId: 'candidate-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
  });

  assert.deepEqual(startImportCandidateApplyRun.mock.calls[0].arguments, [{
    applySafetyMode: 'safe_auto',
    importCandidateIds: ['candidate-1'],
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
    triggeredByUserId: null,
    triggerSource: 'download_completed',
  }]);
  assert.deepEqual(result, {
    attempted: true,
    importCandidateId: 'candidate-1',
    runId: 'apply-run-1',
    started: true,
    triggerSource: 'download_completed',
  });
});

test('startSafeApplyRunAfterDownloadCompleted reports known skipped cases', async () => {
  const service = createImportCandidateAutoApplyRunService({
    startImportCandidateApplyRun: async () => {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'No safe candidates are ready');
    },
  });

  const result = await service.startSafeApplyRunAfterDownloadCompleted({
    importCandidateId: 'candidate-2',
  });

  assert.deepEqual(result, {
    attempted: true,
    errorCode: 'import_candidate_apply_not_ready',
    importCandidateId: 'candidate-2',
    skippedReason: 'no_safe_import_pending_candidate',
    started: false,
    triggerSource: 'download_completed',
  });
});

test('startSafeApplyRunAfterDownloadCompleted promotes another match when completed source files disappeared', async (t) => {
  const handleImportCandidateImportBlocker = t.mock.fn(async () => ({
    recovered: true,
    terminalOutcome: 'source_disappeared',
  }));
  const startImportCandidateApplyRun = t.mock.fn(async () => {
    throw new Error('safe auto add should not start for a missing source');
  });
  const service = createImportCandidateAutoApplyRunService({
    handleImportCandidateImportBlocker,
    previewImportCandidateApply: async () => ({
      counts: {
        collisionCount: 0,
        lossyDecisionRequiredCount: 0,
        missingSourceCount: 1,
      },
      preview: { validation: { blockers: [] } },
      summary: {
        message: 'The expected source file is not reachable from the resolved download path.',
        status: 'blocked',
      },
    }),
    startImportCandidateApplyRun,
  });

  const result = await service.startSafeApplyRunAfterDownloadCompleted({
    importCandidateId: 'candidate-missing-source',
  });

  assert.deepEqual(handleImportCandidateImportBlocker.mock.calls[0].arguments[0], {
    addBlockerCode: 'source_path_unavailable',
    canRecover: true,
    failedCandidateId: 'candidate-missing-source',
    failureReason: 'The expected source file is not reachable from the resolved download path.',
    scheduleFollowUpRun: true,
  });
  assert.equal(startImportCandidateApplyRun.mock.callCount(), 0);
  assert.equal(result.skippedReason, 'completed_source_unavailable');
  assert.equal(result.recovery.recovered, true);
});

test('startSafeApplyRunAfterDownloadCompleted stops collisions before any automatic fallback', async (t) => {
  const handleImportCandidateImportBlocker = t.mock.fn(async () => ({
    reason: 'import_blocker_requires_operator',
    recovered: false,
    requiresOperator: true,
    terminalOutcome: 'import_blocked',
  }));
  const startImportCandidateApplyRun = t.mock.fn(async () => {
    throw new Error('safe auto add should not start for a collision');
  });
  const service = createImportCandidateAutoApplyRunService({
    handleImportCandidateImportBlocker,
    previewImportCandidateApply: async () => ({
      counts: {
        collisionCount: 1,
        lossyDecisionRequiredCount: 0,
        missingSourceCount: 0,
      },
      preview: { validation: { blockers: [] } },
      summary: {
        blockerCode: 'library_collision',
        message: 'A target library path already exists.',
        status: 'blocked',
      },
    }),
    startImportCandidateApplyRun,
  });

  const result = await service.startSafeApplyRunAfterDownloadCompleted({
    importCandidateId: 'candidate-collision',
  });

  assert.equal(handleImportCandidateImportBlocker.mock.calls[0].arguments[0].canRecover, false);
  assert.equal(handleImportCandidateImportBlocker.mock.calls[0].arguments[0].addBlockerCode, 'library_collision');
  assert.equal(startImportCandidateApplyRun.mock.callCount(), 0);
  assert.equal(result.skippedReason, 'import_blocker_requires_operator');
  assert.equal(result.recovery.requiresOperator, true);
});

test('startSafeApplyRunAfterDownloadCompleted records an unavailable audio tool for release-scoped recheck', async (t) => {
  const handleImportCandidateImportBlocker = t.mock.fn(async () => ({
    addBlockerCode: 'media_verification',
    reason: 'environmental_prerequisite_unavailable',
    recovered: false,
    recoveryReasonCode: 'audio_check_failed',
  }));
  const startImportCandidateApplyRun = t.mock.fn(async () => {
    throw new Error('safe auto add should not start while ffprobe is unavailable');
  });
  const service = createImportCandidateAutoApplyRunService({
    handleImportCandidateImportBlocker,
    previewImportCandidateApply: async () => ({
      inspectionWarnings: [{ code: 'media_inspection_unavailable' }],
      summary: {
        message: '1 media inspection warning is present in apply preview.',
        status: 'attention',
      },
    }),
    startImportCandidateApplyRun,
  });

  const result = await service.startSafeApplyRunAfterDownloadCompleted({
    importCandidateId: 'candidate-media-tooling',
  });

  assert.deepEqual(handleImportCandidateImportBlocker.mock.calls[0].arguments[0], {
    addBlockerCode: 'media_verification',
    canRecover: false,
    failedCandidateId: 'candidate-media-tooling',
    failureReason: '1 media inspection warning is present in apply preview.',
    recoveryReasonCode: 'audio_check_failed',
    scheduleFollowUpRun: true,
  });
  assert.equal(startImportCandidateApplyRun.mock.callCount(), 0);
  assert.equal(result.skippedReason, 'media_tooling_unavailable');
  assert.equal(result.recovery.recoveryReasonCode, 'audio_check_failed');
});

test('startSafeApplyRunAfterDownloadCompleted rethrows unexpected errors', async () => {
  const service = createImportCandidateAutoApplyRunService({
    startImportCandidateApplyRun: async () => {
      throw new Error('database unavailable');
    },
  });

  await assert.rejects(
    () => service.startSafeApplyRunAfterDownloadCompleted({ importCandidateId: 'candidate-3' }),
    /database unavailable/,
  );
});

test('persisted Music Queue presence dispatches only to its owning adapter before generic recovery', async () => {
  for (const context of [{ wantedReleaseId: 'saved-primary' }, null, [], {}, 'malformed']) {
    const candidate = { normalizedPayload: { musicQueue: context } };
    const calls = [];
    const service = createImportCandidateAutoApplyRunService({ getImportCandidate: async () => candidate,
      musicQueueAutoSafeAddService: { startAutomaticMusicQueueLibraryAdd: async (input) => { calls.push(input); return { outcome: 'not_available' }; } },
      previewImportCandidateApply: async () => { assert.fail('generic recovery must not inspect owned files'); },
      startImportCandidateApplyRun: async () => { assert.fail('owned scope must not fall through'); } });
    const result = await service.startSafeApplyRunAfterDownloadCompleted({ importCandidateId: 'candidate-owned' });
    assert.equal(calls.length, 1); assert.equal(calls[0].candidate, candidate);
    assert.equal(result.started, false); assert.equal(result.skippedReason, 'music_queue_scope_not_current');
  }
});

test('new automatic guarded queue keeps completion result source and distinguishes existing work without claiming another start', async () => {
  for (const outcome of ['queued', 'already_queued', 'deferred']) {
    const service = createImportCandidateAutoApplyRunService({ getImportCandidate: async () => ({ normalizedPayload: { musicQueueContext: {} } }),
      musicQueueAutoSafeAddService: { startAutomaticMusicQueueLibraryAdd: async () => ({ outcome, runId: 'guarded-run' }) } });
    const result = await service.startSafeApplyRunAfterDownloadCompleted({ importCandidateId: 'owned' });
    assert.equal(result.triggerSource, 'download_completed'); assert.equal(result.started, outcome === 'queued');
    assert.equal(result.alreadyQueued, outcome === 'already_queued' ? true : undefined);
    assert.equal(result.runId, outcome === 'deferred' ? undefined : 'guarded-run');
  }
});
