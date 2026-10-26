/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createWorkerTaskLifecycle } from '../worker-task-lifecycle.js';
import { withWorkerTaskCleanup } from '../worker-task-cleanup.js';
import { createOperationRunLeaseHeartbeat } from '../heartbeat/operation-run-lease-heartbeat.js';
import { createOperationRunLeaseLostError, isOperationRunLeaseLostError } from '../operation-run-lease-error.js';
import { isCurrentJobLeaseAcquisition } from '../job-lease-policy.js';
import {
  createOperationRunInterruptionGate,
  throwIfOperationRunCancellationRequested,
  isOperationRunPauseError,
  isOperationRunCancellationError,
} from '../operation-run-cancellation.js';
import { backupRecoveryCountKeys } from './backup-recovery-policy.js';

export function createBackupRecoveryWorker({
  runStore,
  recoveryService,
  operationPauseService,
  createHeartbeat = createOperationRunLeaseHeartbeat,
} = {}) {
  const interruption = createOperationRunInterruptionGate({
    isCancellationRequested: runStore.isCancellationRequested,
    operationPauseService,
    operationLabel: 'Backup recovery',
  });
  const tasks = createWorkerTaskLifecycle({
    execute: async ({ run }) => {
      let lease, heartbeat, status = 'failed';
      const summary = { ...run.summary };
      await withWorkerTaskCleanup(async () => {
        try {
          lease = await runStore.acquireLease({ runId: run.id });
          heartbeat = createHeartbeat({ renewLease: runStore.renewLease, runId: run.id, expectedLease: lease, intervalMs: 10_000 });
          heartbeat.start();
          const authority = async () => {
            heartbeat.signal?.throwIfAborted();
            if (!isCurrentJobLeaseAcquisition(await runStore.getLease({ runId: run.id }), lease)) throw createOperationRunLeaseLostError();
            await throwIfOperationRunCancellationRequested({ isCancellationRequested: interruption, runId: run.id });
          };
          await authority();
          if (await runStore.markRunStarted({ runId: run.id, expectedLease: lease, summary: { currentStep: 'Checking interrupted backups' } }) === false) return;
          const result = await recoveryService.recoverIncompleteFileOperationPage({
            through: summary.backupRecoveryThrough,
            after: summary.backupRecoveryAfter ?? null,
            assertRecoveryAuthority: authority,
          });
          for (const key of [...backupRecoveryCountKeys, 'processedCount']) {
            summary[key] = (Number.isSafeInteger(summary[key]) ? summary[key] : 0) + (result[key] ?? 0);
          }
          if (result.cursor) summary.backupRecoveryAfter = result.cursor;
          await authority();
          if (result.hasMore || result.ownershipBusy) {
            summary.currentStep = result.ownershipBusy ? 'Waiting for backup filesystem ownership' : 'Backup recovery will continue with the next batch';
            status = 'paused';
            if (await runStore.markRunPaused({ runId: run.id, expectedLease: lease, nextAttemptAt: new Date(Date.now() + 1000).toISOString(), summary }) === false) status = 'failed';
          } else {
            status = 'completed';
            summary.currentStep = summary.deferredCount || summary.awaitingConfirmationCount
              ? 'Backup recovery scan finished; some operations need review' : 'Backup recovery scan finished';
            if (await runStore.markRunCompleted({ runId: run.id, expectedLease: lease, summary }) === false) status = 'failed';
          }
        } catch (error) {
          if (!lease || isOperationRunLeaseLostError(error)) return;
          if (isOperationRunPauseError(error)) {
            status = 'paused';
            summary.currentStep = 'Backup recovery paused for maintenance';
            if (await runStore.markRunPaused({ runId: run.id, expectedLease: lease, nextAttemptAt: error.nextRetryAt ?? new Date(Date.now() + 30_000).toISOString(), summary }) === false) status = 'failed';
          } else if (isOperationRunCancellationError(error)) {
            status = 'cancelled';
            summary.currentStep = 'Backup recovery cancelled';
            if (await runStore.markRunCancelled({ runId: run.id, expectedLease: lease, summary }) === false) status = 'failed';
          } else {
            summary.currentStep = 'Backup recovery could not finish';
            await runStore.markRunFailed({ runId: run.id, expectedLease: lease, errorMessage: 'Backup recovery could not finish. Review Recovery and Background Jobs.', summary });
          }
        }
      }, async () => {
        await withWorkerTaskCleanup(
          async () => { await heartbeat?.stopAndDrain?.(); },
          async () => { if (lease) await runStore.releaseLease({ runId: run.id, expectedLease: lease, status }); },
        );
      });
    }
  });
  return { startWorkerRun: ({ run }) => ({ completion: tasks.start({ runId: run.id, run }) }), close: tasks.close };
}
