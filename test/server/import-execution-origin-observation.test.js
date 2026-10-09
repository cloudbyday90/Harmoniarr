/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createImportCandidateExecutionReconciliationService } from '../../src/server/import-candidates/import-candidate-execution-reconciliation-service.js';
import { shouldRunImportCandidateExecutionHeartbeat } from '../../src/server/import-candidates/import-candidate-execution-heartbeat.js';
import { createImportCandidateExecutionSummaryService } from '../../src/server/import-candidates/import-candidate-execution-summary-service.js';
import { createDownloadAttempt, evaluateDownloadReceipt } from '../../src/server/slskd/slskd-download-attempt-policy.js';
import { randomUUID } from 'node:crypto';

test('one older source in both private worklists preserves its unknown and restored items beside unrelated current work', async (t) => {
  const unknown = { importCandidateId: 'unknown-B', itemStatus: 'awaiting_confirmation',
    planningSnapshot: { execution: { handoff: { state: 'dispatching' } } } };
  const restored = { importCandidateId: 'restored-A', itemStatus: 'queued', downloadReviewRequired: true,
    planningSnapshot: { execution: { handoff: { state: 'confirmed', originResolution: { version: 1 } } } } };
  const summary = { currentRun: { id: 'unrelated-R3', executionMode: 'download_enqueue', items: [] },
    unconfirmedRuns: [{ id: 'older-R1', executionMode: 'download_enqueue', items: [unknown] }],
    restoredRuns: [{ id: 'older-R1', executionMode: 'download_enqueue', items: [restored] }] };
  const confirm = t.mock.fn(async () => ({ confirmed: false, disposition: 'unknown' }));
  const update = t.mock.fn(async (input) => input);
  const service = createImportCandidateExecutionReconciliationService({ confirmDownloadHandoff: confirm,
    updateImportExecutionRunItem: update });
  assert.equal(shouldRunImportCandidateExecutionHeartbeat({ executionSummary: summary }), true);
  await service.reconcileImportCandidateExecutionSummary({ executionSummary: summary });
  assert.deepEqual(confirm.mock.calls.map((call) => call.arguments[0].importCandidateId), ['unknown-B']);
  assert.deepEqual(update.mock.calls.map((call) => call.arguments[0].importCandidateId), ['restored-A']);
});

test('overlapping private item views are reconciled once without discarding another candidate', async (t) => {
  const unknown = { importCandidateId: 'B', itemStatus: 'awaiting_confirmation', planningSnapshot: { execution: {} } };
  const other = { importCandidateId: 'A', itemStatus: 'awaiting_confirmation', planningSnapshot: { execution: {} } };
  const confirm = t.mock.fn(async () => ({ confirmed: false, disposition: 'unknown' }));
  const service = createImportCandidateExecutionReconciliationService({ confirmDownloadHandoff: confirm });
  await service.reconcileImportCandidateExecutionSummary({ executionSummary: {
    unconfirmedRuns: [{ id: 'R1', items: [unknown] }], restoredRuns: [{ id: 'R1', items: [unknown, other] }] } });
  assert.deepEqual(confirm.mock.calls.map((call) => call.arguments[0].importCandidateId).sort(), ['A', 'B']);
});

test('verified restored transfer truth supersedes the historical failed enqueue while current pending and adverse facts remain visible', async () => {
  const attempt = createDownloadAttempt({ importCandidateId: 'candidate', operationRunId: 'R1', username: 'peer', sourceObservation: {},
    requestedFiles: [{ filename: 'One.flac', size: 123 }], providerBinding: { protocol: 'batch', version: '0.26.0', endpointFingerprint: 'a'.repeat(64) } });
  const transfer = { ...attempt.requestedFiles[0], id: randomUUID(), username: 'peer', direction: 'Download', batchId: attempt.attemptId, state: 'InProgress' };
  const proof = evaluateDownloadReceipt({ attempt, enqueueResult: { enqueued: [transfer], failed: [] } });
  for (const [runStatus, unavailable, expectedStatus] of [['failed', false, 'ready'], ['failed', true, 'attention'], ['pending', false, 'running']]) {
    const service = createImportCandidateExecutionSummaryService({
      importCandidateExecutionRunStore: { getLatestRun: async () => ({ id: 'R1', status: runStatus, executionMode: 'download_enqueue',
        downloadOriginResolved: true, errorMessage: 'Historical response was lost' }), getActiveRun: async () => null },
      listImportExecutionRunItemsFn: async () => [{ importCandidateId: 'candidate', itemStatus: 'queued',
        planningSnapshot: { execution: { requestedFiles: attempt.requestedFiles, handoff: { state: 'confirmed', attempt: proof.attempt } } } }],
      buildTransferSnapshot: async () => ({ getTransfer: () => unavailable ? null : transfer, isObservationPending: () => unavailable }),
    });
    const summary = await service.buildImportCandidateExecutionSummary();
    assert.equal(summary.summary.status, expectedStatus);
    if (runStatus === 'failed') assert.doesNotMatch(summary.summary.message, /Historical response|execution run failed/u);
  }
});
