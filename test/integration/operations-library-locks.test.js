import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { operationRunRegistry } from '../../src/shared/operation-run-descriptors.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { seedOperationRunFixture } from '../../testing/integration/operation-run-fixtures.js';
import { enterMaintenanceLock } from '../../testing/integration/recovery-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let integrationRuntime;
let runtimeUnavailableReason = null;

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

  test('maintenance locks block library discovery, organize, and scan run starts consistently', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client }) => {
      await bootstrapAdminSession(client);

      const lockResponse = await enterMaintenanceLock(client, {
        idempotencyKey: 'library-lock-guard-1',
        reason: 'Pause unsafe library writes',
      });
      assert.equal(lockResponse.response.status, 202);

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
});
