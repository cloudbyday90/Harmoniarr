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

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { operationRunRegistry } from '../../src/shared/operation-run-descriptors.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { seedOperationRunFixture } from '../../testing/integration/operation-run-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let integrationRuntime;
let runtimeUnavailableReason = null;

suite('integration operation stranded-run recovery', () => {
  before(async () => {
    try {
      integrationRuntime = await createIntegrationAppRuntime({
        config: integrationRuntimeConfig,
      });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) {
        throw error;
      }

      runtimeUnavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, {
    timeout: integrationRuntimeConfig.suiteSetupTimeoutMs,
  });

  after(async () => {
    await integrationRuntime?.cleanup();
  }, {
    timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs,
  });

  test('stranded-run recovery detects and retries a running run with an expired claim', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      const bootstrapResponse = await bootstrapAdminSession(client);
      const adminUserId = bootstrapResponse.payload.user.id;

      const strandedRun = await seedOperationRunFixture({
        queryable: getPoolFn(),
        runOverrides: {
          attemptCount: 1,
          claimedAt: '2026-05-03T00:00:00.000Z',
          claimedByInstanceId: 'dead-worker-instance',
          maxAttempts: 3,
          operationType: operationRunRegistry.libraryScan.operationType,
          startedAt: '2026-05-03T00:00:00.000Z',
          status: 'running',
          summary: {
            libraryRoot: '/library/music',
          },
          triggeredByUserId: adminUserId,
        },
      });

      assert.equal(strandedRun.status, 'running');
      assert.equal(strandedRun.claimedByInstanceId, 'dead-worker-instance');

      const recoveryQueueStore = createOperationQueueStore({
        claimOwnerInstanceId: 'integration-recovery-worker',
        getPoolFn,
      });

      const recoverableRuns = await recoveryQueueStore.listRecoverableRuns({
        operationTypes: [operationRunRegistry.libraryScan.operationType],
      });

      const found = recoverableRuns.find((run) => run.id === strandedRun.id);
      assert.ok(found, 'stranded run should appear in recoverable runs list');
      assert.equal(found.status, 'running');
      assert.equal(found.claimedByInstanceId, 'dead-worker-instance');

      const retryResult = await recoveryQueueStore.recoverRunForRetry({
        maxAttempts: 3,
        nextAttemptAt: new Date().toISOString(),
        runId: strandedRun.id,
        summary: {
          currentStep: 'Library scan recovered from stranded run',
          lastFailureMessage: 'Worker instance lost; run recovered by stranded-run detection',
        },
      });

      assert.ok(retryResult, 'recoverRunForRetry should return the updated run');
      assert.equal(retryResult.status, 'pending');
      assert.equal(retryResult.attemptCount, 1);
      assert.equal(retryResult.claimedByInstanceId, null);
      assert.equal(retryResult.claimedAt, null);
      assert.ok(retryResult.nextAttemptAt);

      const historyResponse = await client.requestJson('/api/v1/operations/history', {
        method: 'GET',
      });

      assert.equal(historyResponse.response.status, 200);
      const recoveredRun = historyResponse.payload.runs.find(
        (run) => run.id === strandedRun.id,
      );
      assert.ok(recoveredRun, 'recovered run should appear in operation history');
      assert.equal(recoveredRun.status, 'pending');

      const reclaimedRun = await recoveryQueueStore.claimNextRunnableRun({
        operationTypes: [operationRunRegistry.libraryScan.operationType],
      });

      assert.ok(reclaimedRun, 'recovered run should be claimable');
      assert.equal(reclaimedRun.id, strandedRun.id);
      assert.equal(reclaimedRun.attemptCount, 2);
      assert.equal(reclaimedRun.claimedByInstanceId, 'integration-recovery-worker');
    }, {
      scenarioName: 'stranded_run_recovery_retry',
    });
  });

  test('stranded-run recovery marks an exhausted run as failed instead of retrying', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      const bootstrapResponse = await bootstrapAdminSession(client);
      const adminUserId = bootstrapResponse.payload.user.id;

      const exhaustedRun = await seedOperationRunFixture({
        queryable: getPoolFn(),
        runOverrides: {
          attemptCount: 3,
          claimedAt: '2026-05-03T00:00:00.000Z',
          claimedByInstanceId: 'dead-worker-exhausted',
          maxAttempts: 3,
          operationType: operationRunRegistry.libraryOrganizeApply.operationType,
          startedAt: '2026-05-03T00:00:00.000Z',
          status: 'running',
          summary: {
            plannedRenameCount: 10,
          },
          triggeredByUserId: adminUserId,
        },
      });

      assert.equal(exhaustedRun.attemptCount, 3);
      assert.equal(exhaustedRun.maxAttempts, 3);

      const recoveryQueueStore = createOperationQueueStore({
        claimOwnerInstanceId: 'integration-recovery-worker',
        getPoolFn,
      });

      const failedResult = await recoveryQueueStore.markStrandedRunFailed({
        errorMessage: 'Worker instance lost after exhausting retry budget; stranded run marked failed',
        runId: exhaustedRun.id,
        summary: {
          currentStep: 'Library organize apply failed',
          plannedRenameCount: 10,
        },
      });

      assert.ok(failedResult, 'markStrandedRunFailed should return the updated run');
      assert.equal(failedResult.status, 'failed');
      assert.equal(failedResult.claimedByInstanceId, null);
      assert.equal(failedResult.claimedAt, null);
      assert.ok(failedResult.finishedAt);
      assert.match(failedResult.errorMessage, /exhausting retry budget/);

      const persistedRow = await getPoolFn().query(
        `
          SELECT status, error_message, finished_at, claimed_at, claimed_by_instance_id
          FROM operation_runs
          WHERE id = $1
        `,
        [exhaustedRun.id],
      );

      assert.equal(persistedRow.rows[0]?.status, 'failed');
      assert.equal(persistedRow.rows[0]?.claimed_at, null);
      assert.equal(persistedRow.rows[0]?.claimed_by_instance_id, null);
      assert.ok(persistedRow.rows[0]?.finished_at);

      const runDetailResponse = await client.requestJson(
        `/api/v1/operations/runs/${exhaustedRun.id}`,
        { method: 'GET' },
      );

      assert.equal(runDetailResponse.response.status, 200);
      assert.equal(runDetailResponse.payload.operationRun.run.status, 'failed');
      assert.equal(runDetailResponse.payload.operationRun.run.errorMessage, failedResult.errorMessage);
    }, {
      scenarioName: 'stranded_run_recovery_failed',
    });
  });

  test('stranded-run recovery prevents double-recovery of an already-recovered run', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      const bootstrapResponse = await bootstrapAdminSession(client);
      const adminUserId = bootstrapResponse.payload.user.id;

      const strandedRun = await seedOperationRunFixture({
        queryable: getPoolFn(),
        runOverrides: {
          attemptCount: 1,
          claimedAt: '2026-05-03T00:00:00.000Z',
          claimedByInstanceId: 'dead-worker-unique',
          maxAttempts: 2,
          operationType: operationRunRegistry.importCandidateApply.operationType,
          startedAt: '2026-05-03T00:00:00.000Z',
          status: 'running',
          summary: {},
          triggeredByUserId: adminUserId,
        },
      });

      const recoveryQueueStore = createOperationQueueStore({
        claimOwnerInstanceId: 'integration-recovery-worker',
        getPoolFn,
      });

      const firstRecovery = await recoveryQueueStore.recoverRunForRetry({
        maxAttempts: 2,
        nextAttemptAt: new Date().toISOString(),
        runId: strandedRun.id,
      });

      assert.ok(firstRecovery, 'first recovery should succeed');
      assert.equal(firstRecovery.status, 'pending');

      const secondRecovery = await recoveryQueueStore.recoverRunForRetry({
        maxAttempts: 2,
        nextAttemptAt: new Date().toISOString(),
        runId: strandedRun.id,
      });

      assert.equal(secondRecovery, null, 'double recovery should return null because status is no longer running');
    }, {
      scenarioName: 'stranded_run_double_recovery_guard',
    });
  });
});
