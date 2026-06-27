import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createLibraryScanRunStore } from '../../src/server/library/library-scan-run-store.js';
import { createLibraryScanWorker } from '../../src/server/library/library-scan-worker.js';
import { createOperationQueueDispatcher } from '../../src/server/operation-queue-dispatcher.js';
import {
  createOperationRunInterruptionGate,
} from '../../src/server/operation-run-cancellation.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import {
  createMaintenanceLockOperationPauseService,
} from '../../src/server/recovery/maintenance-lock-operation-pause-service.js';
import { maintenanceLockPauseCode } from '../../src/server/recovery/maintenance-lock-policy.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { operationRunRegistry } from '../../src/shared/operation-run-descriptors.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { seedOperationRunFixture } from '../../testing/integration/operation-run-fixtures.js';
import {
  acquireIntegrationLock,
  releaseIntegrationLock,
} from '../../testing/integration/recovery-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let integrationRuntime;
let runtimeUnavailableReason = null;

async function waitForPersistedOperationRun(getPoolFn, runId, {
  intervalMs = 25,
  timeoutMs = 2000,
} = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const result = await getPoolFn().query(
      `
        SELECT
          attempt_count,
          claimed_at,
          claimed_by_instance_id,
          error_message,
          finished_at,
          next_attempt_at,
          status,
          summary
        FROM operation_runs
        WHERE id = $1
      `,
      [runId],
    );

    const row = result.rows[0] ?? null;
    if (row?.status === 'pending' && row.claimed_at === null && row.claimed_by_instance_id === null) {
      return row;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }

  throw new Error(`Timed out waiting for operation run ${runId} to return to pending`);
}

async function readOperationRunQueueState(getPoolFn, runId) {
  const result = await getPoolFn().query(
    `
      SELECT
        attempt_count,
        claimed_at,
        claimed_by_instance_id,
        next_attempt_at,
        status,
        summary
      FROM operation_runs
      WHERE id = $1
    `,
    [runId],
  );

  return result.rows[0] ?? null;
}

suite('integration operations lifecycle and library lock routes', () => {
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

  test('operation cancel route persists cancellation intent and rejects a duplicate cancel request', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      const bootstrapResponse = await bootstrapAdminSession(client);
      const adminUserId = bootstrapResponse.payload.user.id;

      const seededRun = await seedOperationRunFixture({
        queryable: getPoolFn(),
        runOverrides: {
          attemptCount: 1,
          maxAttempts: 2,
          operationType: operationRunRegistry.libraryScan.operationType,
          startedAt: '2026-05-03T00:00:00.000Z',
          status: 'running',
          summary: {
            libraryRoot: '/library/music',
          },
          triggeredByUserId: adminUserId,
        },
      });

      const cancelResponse = await client.requestJson(`/api/v1/operations/runs/${seededRun.id}/cancel`, {
        csrf: true,
        method: 'POST',
      });

      assert.equal(cancelResponse.response.status, 200);
      assert.equal(cancelResponse.payload.ok, true);
      assert.equal(cancelResponse.payload.operationRun.id, seededRun.id);
      assert.equal(cancelResponse.payload.operationRun.status, 'running');
      assert.equal(cancelResponse.payload.operationRun.cancelRequestedByUserId, adminUserId);
      assert.ok(cancelResponse.payload.operationRun.cancelRequestedAt);

      const persistedRows = await getPoolFn().query(
        `
          SELECT cancel_requested_at, cancel_requested_by_user_id
          FROM operation_runs
          WHERE id = $1
        `,
        [seededRun.id],
      );
      assert.equal(persistedRows.rows[0]?.cancel_requested_by_user_id, adminUserId);
      assert.ok(persistedRows.rows[0]?.cancel_requested_at);

      const duplicateCancelResponse = await client.requestJson(`/api/v1/operations/runs/${seededRun.id}/cancel`, {
        csrf: true,
        method: 'POST',
      });
      assert.equal(duplicateCancelResponse.response.status, 409);
      assert.equal(duplicateCancelResponse.payload.error.code, 'operation_run_not_cancellable');
    }, {
      scenarioName: 'operation_cancel_request',
    });
  });

  test('operation retry route reschedules a failed run and clears prior failure state', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      const bootstrapResponse = await bootstrapAdminSession(client);
      const adminUserId = bootstrapResponse.payload.user.id;

      const seededRun = await seedOperationRunFixture({
        queryable: getPoolFn(),
        runOverrides: {
          attemptCount: 1,
          errorMessage: 'worker crashed during prior run',
          finishedAt: '2026-05-03T00:05:00.000Z',
          maxAttempts: 1,
          operationType: operationRunRegistry.artworkCleanup.operationType,
          startedAt: '2026-05-03T00:00:00.000Z',
          status: 'failed',
          summary: {
            requestedAssetCount: 3,
          },
          triggeredByUserId: adminUserId,
        },
      });

      const retryResponse = await client.requestJson(`/api/v1/operations/runs/${seededRun.id}/retry`, {
        csrf: true,
        method: 'POST',
      });

      assert.equal(retryResponse.response.status, 200);
      assert.equal(retryResponse.payload.ok, true);
      assert.equal(retryResponse.payload.operationRun.id, seededRun.id);
      assert.equal(retryResponse.payload.operationRun.status, 'pending');
      assert.equal(retryResponse.payload.operationRun.errorMessage, null);
      assert.equal(retryResponse.payload.operationRun.finishedAt, null);
      assert.equal(retryResponse.payload.operationRun.cancelRequestedAt, null);
      assert.equal(retryResponse.payload.operationRun.maxAttempts, 2);
      assert.ok(retryResponse.payload.operationRun.nextAttemptAt);

      const persistedRows = await getPoolFn().query(
        `
          SELECT
            status,
            error_message,
            finished_at,
            cancel_requested_at,
            max_attempts,
            claimed_at,
            claimed_by_instance_id
          FROM operation_runs
          WHERE id = $1
        `,
        [seededRun.id],
      );
      assert.equal(persistedRows.rows[0]?.status, 'pending');
      assert.equal(persistedRows.rows[0]?.error_message, null);
      assert.equal(persistedRows.rows[0]?.finished_at, null);
      assert.equal(persistedRows.rows[0]?.cancel_requested_at, null);
      assert.equal(persistedRows.rows[0]?.max_attempts, 2);
      assert.equal(persistedRows.rows[0]?.claimed_at, null);
      assert.equal(persistedRows.rows[0]?.claimed_by_instance_id, null);
    }, {
      scenarioName: 'operation_retry_request',
    });
  });

  test('locks block library discovery, organize, and scan run starts consistently', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdminSession(client);

      await acquireIntegrationLock(getPoolFn(), {
        lockType: 'restore',
        reason: 'Pause unsafe library writes',
      });

      const discoveryResponse = await client.requestJson('/api/v1/library/discovery-runs', {
        csrf: true,
        method: 'POST',
      });
      const organizeResponse = await client.requestJson('/api/v1/library/organize-runs', {
        csrf: true,
        method: 'POST',
      });
      const scanResponse = await client.requestJson('/api/v1/library/scan-runs', {
        csrf: true,
        method: 'POST',
      });

      for (const response of [
        discoveryResponse,
        organizeResponse,
        scanResponse,
      ]) {
        assert.equal(response.response.status, 409);
        assert.equal(response.payload.error.code, 'recovery_lock_conflict');
      }

      assert.match(discoveryResponse.payload.error.message, /prevents library discovery dispatch/i);
      assert.match(organizeResponse.payload.error.message, /prevents library organize apply/i);
      assert.match(scanResponse.payload.error.message, /prevents library scan/i);
    }, {
      scenarioName: 'maintenance_lock_library_run_guards',
    });
  });

  test('a lock pauses a claimed library scan run and returns it to pending without spending retry budget', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdminSession(client);

      const runStore = createLibraryScanRunStore({ getPoolFn });
      const queueStore = createOperationQueueStore({
        claimOwnerInstanceId: 'integration-library-scan-worker',
        getPoolFn,
      });
      const maintenanceLockService = createMaintenanceLockService({ getPoolFn });
      const operationPauseService = createMaintenanceLockOperationPauseService({
        listActiveMaintenanceLocks: maintenanceLockService.listActiveMaintenanceLocks,
      });
      let executeScanCallCount = 0;

      const worker = createLibraryScanWorker({
        acquireLease: runStore.acquireLease,
        createOperationRunLeaseHeartbeatFn: () => ({
          start() {},
          stop() {},
        }),
        executeScan: async ({ libraryRoot }) => {
          executeScanCallCount += 1;

          return {
            filesMatched: 0,
            filesSeen: 0,
            filesUnmatched: 0,
            libraryRoot,
          };
        },
        isCancellationRequested: createOperationRunInterruptionGate({
          isCancellationRequested: runStore.isCancellationRequested,
          operationLabel: 'Library scan',
          operationPauseService,
        }),
        markRunCancelled: runStore.markRunCancelled,
        markRunCompleted: runStore.markRunCompleted,
        markRunFailed: runStore.markRunFailed,
        markRunPaused: runStore.markRunPaused,
        markRunStarted: runStore.markRunStarted,
        releaseLease: runStore.releaseLease,
        renewLease: runStore.renewLease,
      });

      const seededRun = await runStore.createOperationRun({
        libraryRoot: '/library/music',
        status: 'pending',
        triggeredByUserId: null,
      });

      const claimedRun = await queueStore.claimNextRunnableRun({
        operationTypes: [operationRunRegistry.libraryScan.operationType],
      });

      assert.equal(claimedRun?.id, seededRun.id);
      assert.equal(claimedRun?.attemptCount, 1);
      assert.equal(claimedRun?.status, 'pending');
      assert.ok(claimedRun?.claimedAt);
      assert.equal(claimedRun?.claimedByInstanceId, 'integration-library-scan-worker');

      const lock = await acquireIntegrationLock(getPoolFn(), {
        lockType: 'restore',
        reason: 'Pause claimed library scan worker startup',
      });
      assert.ok(lock.id);

      await worker.startWorkerRun({
        libraryRoot: '/library/music',
        runId: seededRun.id,
      });

      const persistedRun = await waitForPersistedOperationRun(getPoolFn, seededRun.id);

      assert.equal(executeScanCallCount, 0);
      assert.equal(persistedRun.status, 'pending');
      assert.equal(persistedRun.attempt_count, 0);
      assert.equal(persistedRun.claimed_at, null);
      assert.equal(persistedRun.claimed_by_instance_id, null);
      assert.equal(persistedRun.error_message, null);
      assert.equal(persistedRun.finished_at, null);
      assert.ok(persistedRun.next_attempt_at);
      assert.equal(persistedRun.summary.libraryRoot, '/library/music');
      assert.equal(persistedRun.summary.currentStep, 'Library scan paused by maintenance lock');
      assert.equal(persistedRun.summary.pauseCode, maintenanceLockPauseCode);
      assert.equal(persistedRun.summary.pauseProvider, 'restore');
      assert.match(persistedRun.summary.pauseMessage, /library scan is paused while the restore maintenance lock is active/i);
    }, {
      scenarioName: 'maintenance_lock_library_scan_worker_pause',
    });
  });

  test('operation queue dispatcher leaves queued runs unclaimed while a maintenance lock is active and resumes after release', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdminSession(client);

      const runStore = createLibraryScanRunStore({ getPoolFn });
      const queueStore = createOperationQueueStore({
        claimOwnerInstanceId: 'integration-dispatcher-worker',
        getPoolFn,
      });
      const maintenanceLockService = createMaintenanceLockService({ getPoolFn });
      const operationPauseService = createMaintenanceLockOperationPauseService({
        listActiveMaintenanceLocks: maintenanceLockService.listActiveMaintenanceLocks,
      });
      const handledRunIds = [];
      const recoverStrandedRuns = t.mock.fn(async () => ({
        activeLeaseCount: 0,
        failedCount: 0,
        retriedCount: 0,
        scannedCount: 0,
        skipped: true,
      }));
      const dispatcher = createOperationQueueDispatcher({
        dispatchPauseService: operationPauseService,
        handlers: {
          [operationRunRegistry.libraryScan.operationType]: async ({ run }) => {
            handledRunIds.push(run.id);
          },
        },
        operationQueueStore: queueStore,
        operationStrandedRunRecoveryService: {
          recoverStrandedRuns,
        },
      });

      const seededRun = await runStore.createOperationRun({
        libraryRoot: '/library/music',
        status: 'pending',
        triggeredByUserId: null,
      });
      const lock = await acquireIntegrationLock(getPoolFn(), {
        lockType: 'restore',
        reason: 'Pause queued worker dispatch',
      });

      const pausedResult = await dispatcher.tick();
      const pausedRun = await readOperationRunQueueState(getPoolFn, seededRun.id);

      assert.deepEqual(pausedResult, {
        claimedCount: 0,
        failedCount: 0,
        nextRetryAt: null,
        pauseCode: maintenanceLockPauseCode,
        pauseMessage: 'Operation queue dispatch is paused while the restore maintenance lock is active.',
        pauseProvider: 'restore',
        pausedOperationTypes: [operationRunRegistry.libraryScan.operationType],
        reason: 'paused',
        retriedCount: 0,
        scannedCount: 0,
        skipped: true,
      });
      assert.equal(recoverStrandedRuns.mock.callCount(), 0);
      assert.deepEqual(handledRunIds, []);
      assert.equal(pausedRun.status, 'pending');
      assert.equal(pausedRun.attempt_count, 0);
      assert.equal(pausedRun.claimed_at, null);
      assert.equal(pausedRun.claimed_by_instance_id, null);
      assert.equal(pausedRun.summary.libraryRoot, '/library/music');

      await releaseIntegrationLock(getPoolFn(), lock.id);

      const resumedResult = await dispatcher.tick();
      const claimedRun = await readOperationRunQueueState(getPoolFn, seededRun.id);

      assert.deepEqual(resumedResult, {
        claimedCount: 1,
        failedCount: 0,
        retriedCount: 0,
        scannedCount: 0,
        skipped: false,
      });
      assert.deepEqual(recoverStrandedRuns.mock.calls[0].arguments, [{
        operationTypes: [operationRunRegistry.libraryScan.operationType],
      }]);
      assert.deepEqual(handledRunIds, [seededRun.id]);
      assert.equal(claimedRun.status, 'pending');
      assert.equal(claimedRun.attempt_count, 1);
      assert.ok(claimedRun.claimed_at);
      assert.equal(claimedRun.claimed_by_instance_id, 'integration-dispatcher-worker');
      assert.equal(claimedRun.summary.libraryRoot, '/library/music');
    }, {
      scenarioName: 'maintenance_lock_queued_worker_dispatch_pause',
    });
  });
});
