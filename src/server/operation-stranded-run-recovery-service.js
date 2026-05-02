/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { buildJobLeaseKey, createJobLeaseStore } from './job-lease-store.js';
import { createOperationQueueStore } from './operation-queue-store.js';
import { createOperationRetryPolicyService } from './operation-retry-policy-service.js';

const defaultRecoveryLimit = 25;

function normalizeRecoveryLimit(limit) {
  const parsed = Number.parseInt(limit, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultRecoveryLimit;
  }

  return Math.min(parsed, 100);
}

function buildRecoveryReason(lease) {
  if (!lease) {
    return 'lease_missing';
  }

  return `lease_${lease.state}`;
}

function buildRecoveryErrorMessage(recoveryReason) {
  switch (recoveryReason) {
    case 'lease_missing':
      return 'Worker lease was missing during stranded run recovery';
    case 'lease_expired':
      return 'Worker lease expired during stranded run recovery';
    case 'lease_released':
      return 'Worker lease was unexpectedly released during stranded run recovery';
    default:
      return 'Stranded run recovery detected a worker lease mismatch';
  }
}

export function createOperationStrandedRunRecoveryService({
  jobLeaseStore = createJobLeaseStore(),
  nowFn = () => new Date(),
  operationQueueStore = createOperationQueueStore(),
  retryPolicyService = createOperationRetryPolicyService(),
} = {}) {
  async function recoverStrandedRuns({ limit = defaultRecoveryLimit, operationTypes } = {}) {
    const candidateRuns = await operationQueueStore.listRecoverableRuns({
      limit: normalizeRecoveryLimit(limit),
      operationTypes,
    });

    if (candidateRuns.length === 0) {
      return {
        activeLeaseCount: 0,
        failedCount: 0,
        retriedCount: 0,
        scannedCount: 0,
        skipped: true,
      };
    }

    const leaseMap = new Map(
      (await jobLeaseStore.listLeases({
        leaseKeys: candidateRuns.map((run) => buildJobLeaseKey({
          jobType: run.operationType,
          runId: run.id,
        })),
      })).map((lease) => [lease.leaseKey, lease]),
    );

    let activeLeaseCount = 0;
    let failedCount = 0;
    let retriedCount = 0;

    for (const run of candidateRuns) {
      const leaseKey = buildJobLeaseKey({
        jobType: run.operationType,
        runId: run.id,
      });
      const lease = leaseMap.get(leaseKey) ?? null;

      if (lease?.state === 'active') {
        activeLeaseCount += 1;
        continue;
      }

      const recoveryReason = buildRecoveryReason(lease);
      const recoveryDetectedAt = nowFn().toISOString();

      if (lease?.state === 'expired') {
        await jobLeaseStore.releaseLease({
          leaseKey,
          status: 'expired',
        });
      }

      const retrySchedule = retryPolicyService.buildRetrySchedule({
        attemptCount: run.attemptCount,
        maxAttempts: run.maxAttempts,
      });

      if (retrySchedule) {
        const recoveredRun = await operationQueueStore.recoverRunForRetry({
          maxAttempts: run.maxAttempts,
          nextAttemptAt: retrySchedule.nextAttemptAt,
          runId: run.id,
          summary: {
            currentStep: 'Automatic retry scheduled after stranded run recovery',
            lastFailureMessage: buildRecoveryErrorMessage(recoveryReason),
            recoveryDetectedAt,
            recoveryReason,
            retryScheduledAt: retrySchedule.nextAttemptAt,
          },
        });

        if (recoveredRun) {
          retriedCount += 1;
        }

        continue;
      }

      const failedRun = await operationQueueStore.markStrandedRunFailed({
        errorMessage: buildRecoveryErrorMessage(recoveryReason),
        runId: run.id,
        summary: {
          currentStep: 'Stranded run recovery marked the run as failed',
          recoveryDetectedAt,
          recoveryReason,
        },
      });

      if (failedRun) {
        failedCount += 1;
      }
    }

    return {
      activeLeaseCount,
      failedCount,
      retriedCount,
      scannedCount: candidateRuns.length,
      skipped: false,
    };
  }

  return {
    recoverStrandedRuns,
  };
}