import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import {
  createImportCandidatePostApplyScanService,
  isSafePostApplyScanError,
  postApplyScanTriggerReason,
} from '../../src/server/import-candidates/import-candidate-post-apply-scan-service.js';

test('post-apply scan service queues a system library scan with apply-run context', async (t) => {
  const startLibraryScan = t.mock.fn(async () => ({
    accepted: true,
    run: { id: 'scan-run-1' },
  }));
  const service = createImportCandidatePostApplyScanService({ startLibraryScan });

  const result = await service.schedulePostApplyLibraryScan({
    triggeredByRunId: 'apply-run-1',
  });

  assert.deepEqual(startLibraryScan.mock.calls[0].arguments, [{
    triggeredByRunId: 'apply-run-1',
    triggeredByUserId: null,
    triggerReason: postApplyScanTriggerReason,
  }]);
  assert.deepEqual(result, {
    accepted: true,
    reason: null,
    scanRunId: 'scan-run-1',
    status: 'scheduled',
    triggeredByRunId: 'apply-run-1',
  });
});

test('post-apply scan service suppresses expected scan concurrency and readiness errors', async () => {
  assert.equal(isSafePostApplyScanError(createApiError(409, 'library_scan_in_progress', 'Scan active')), true);
  assert.equal(isSafePostApplyScanError(createApiError(409, 'library_scan_not_ready', 'Configure a root')), true);
  assert.equal(isSafePostApplyScanError(createApiError(409, 'recovery_lock_conflict', 'Restore active')), false);

  const service = createImportCandidatePostApplyScanService({
    startLibraryScan: async () => {
      throw createApiError(409, 'library_scan_in_progress', 'A library scan is already running or queued');
    },
  });

  assert.deepEqual(await service.schedulePostApplyLibraryScan({ triggeredByRunId: 'apply-run-2' }), {
    accepted: false,
    reason: 'library_scan_in_progress',
    scanRunId: null,
    status: 'suppressed',
    triggeredByRunId: 'apply-run-2',
  });
});

test('post-apply scan service returns failed for unexpected scan errors without throwing', async () => {
  const service = createImportCandidatePostApplyScanService({
    startLibraryScan: async () => {
      throw createApiError(500, 'database_unavailable', 'Database unavailable');
    },
  });

  assert.deepEqual(await service.schedulePostApplyLibraryScan({ triggeredByRunId: 'apply-run-3' }), {
    accepted: false,
    reason: 'database_unavailable',
    scanRunId: null,
    status: 'failed',
    triggeredByRunId: 'apply-run-3',
  });
});

test('post-apply scan service reports unavailable when no scan service is wired', async () => {
  const service = createImportCandidatePostApplyScanService();

  assert.deepEqual(await service.schedulePostApplyLibraryScan({ triggeredByRunId: 'apply-run-4' }), {
    accepted: false,
    reason: 'library_scan_service_unavailable',
    scanRunId: null,
    status: 'unavailable',
    triggeredByRunId: 'apply-run-4',
  });
});
