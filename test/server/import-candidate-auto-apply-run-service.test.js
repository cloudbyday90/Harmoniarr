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
