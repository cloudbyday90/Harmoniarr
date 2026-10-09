/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createImportCandidateExecutionWorker } from '../../src/server/import-candidates/import-candidate-execution-worker.js';
import { createImportCandidateApplyWorker } from '../../src/server/import-candidates/import-candidate-apply-worker.js';
import { createImportCandidateMediaInspectionWorker } from '../../src/server/import-candidates/import-candidate-media-inspection-worker.js';
import { createImportCandidateTranscodeWorker } from '../../src/server/import-candidates/import-candidate-transcode-worker.js';
import { createTestJobLease } from '../../testing/server/job-lease-fixtures.js';

const factories = [createImportCandidateExecutionWorker, createImportCandidateApplyWorker,
  createImportCandidateMediaInspectionWorker, createImportCandidateTranscodeWorker];
for (const factory of factories) {
  test(`${factory.name} stops a refused start before completing work and releases only its captured acquisition`, async (t) => {
    const lease = createTestJobLease('import-test', 'run'); let done;
    const finished = new Promise((resolve) => { done = resolve; });
    const markRunStarted = t.mock.fn(async (input) => { assert.equal(input.expectedLease, lease); return false; });
    const markRunCompleted = t.mock.fn(async () => true); const markRunFailed = t.mock.fn(async () => true);
    const releaseLease = t.mock.fn(async (input) => { assert.equal(input.expectedLease, lease); done(); });
    const worker = factory({ acquireLease: async () => lease, markRunStarted, markRunCompleted, markRunFailed, releaseLease });
    worker.startWorkerRun({ runId: 'run', requestedCandidateCount: 1 }); await finished;
    assert.equal(markRunStarted.mock.callCount(), 1); assert.equal(markRunCompleted.mock.callCount(), 0);
    assert.equal(markRunFailed.mock.callCount(), 0); assert.equal(releaseLease.mock.callCount(), 1);
  });
  test(`${factory.name} never marks or releases another owner after acquisition refusal`, async (t) => {
    let attempted; const acquired = new Promise((resolve) => { attempted = resolve; });
    const markRunStarted = t.mock.fn(); const markRunFailed = t.mock.fn(); const releaseLease = t.mock.fn();
    const worker = factory({ acquireLease: async () => { attempted(); throw Object.assign(new Error('Already owned'), { code: 'operation_run_lease_unavailable' }); },
      markRunStarted, markRunFailed, releaseLease });
    worker.startWorkerRun({ runId: 'run', requestedCandidateCount: 1 }); await acquired;
    await new Promise((resolve) => { setImmediate(resolve); });
    assert.equal(markRunStarted.mock.callCount(), 0); assert.equal(markRunFailed.mock.callCount(), 0);
    assert.equal(releaseLease.mock.callCount(), 0);
  });
}
