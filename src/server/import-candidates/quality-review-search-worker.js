/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createWorkerTaskLifecycle } from '../worker-task-lifecycle.js';
import { withWorkerTaskCleanup } from '../worker-task-cleanup.js';
import { drainWorkerLease } from '../worker-lease-cleanup.js';
import { createOperationRunLeaseHeartbeat } from '../heartbeat/operation-run-lease-heartbeat.js';
import { isOperationRunLeaseLostError } from '../operation-run-lease-error.js';
import { isOperationRunPauseError } from '../operation-run-cancellation.js';

/** One bounded window per claim; operation-run ownership lasts through cleanup. */
export function createQualityReviewSearchWorker({ runStore, executeStep,
  createHeartbeat = createOperationRunLeaseHeartbeat } = {}) {
  const tasks = createWorkerTaskLifecycle({ execute: run });
  async function run({ runId }) {
    let lease = null; let heartbeat = null; let status = 'completed';
    return withWorkerTaskCleanup(async () => {
      try {
        lease = await runStore.acquireLease({ runId }); if (!lease) return;
        heartbeat = createHeartbeat({ runId, expectedLease: lease, renewLease: runStore.renewLease }); heartbeat.start();
        if (!await runStore.markRunStarted({ runId, expectedLease: lease, summary: { currentStep: 'Checking available matches' } })) return;
        const result = await executeStep({ runId, expectedLease: lease });
        status = result?.paused ? 'paused' : result?.cancelled ? 'cancelled' : 'completed';
      } catch (error) {
        status = 'failed';
        if (!lease) { if (isOperationRunLeaseLostError(error) || error?.code === 'operation_run_lease_unavailable') return; throw error; }
        if (isOperationRunLeaseLostError(error)) return;
        if (error?.code === 'quality_review_search_busy' || error?.code === 'recovery_lock_conflict' || isOperationRunPauseError(error)) {
          status = 'paused';
          await runStore.markRunPaused({ runId, expectedLease: lease, nextAttemptAt: new Date(Date.now() + 1000).toISOString(),
            summary: { currentStep: 'Waiting to check current matches' } });
          return;
        }
        await runStore.markRunStopped({ runId, expectedLease: lease, errorMessage: error?.message ?? 'Match check failed',
          summary: { currentStep: 'Match check stopped. Refresh the release before trying again.' } });
      }
    }, () => drainWorkerLease({ heartbeat, lease, releaseLease: runStore.releaseLease, runId, status }));
  }
  return { startWorkerRun: async input => ({ completion: tasks.start(input) }), close: tasks.close };
}
