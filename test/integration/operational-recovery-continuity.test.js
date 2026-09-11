/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createJobLeaseStore } from '../../src/server/job-lease-store.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createOperationStrandedRunRecoveryService } from '../../src/server/operation-stranded-run-recovery-service.js';
import { bootstrapDatabaseSchemaFromSnapshot } from '../../src/server/schema-bootstrap.js';
import { operationRunRegistry } from '../../src/shared/operation-run-descriptors.js';
import { seedOperationRunFixture } from '../../testing/integration/operation-run-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { seedOperationalRecoveryFixture, verifyRestoredOperationalRecovery } from '../../testing/recovery/operational-recovery-fixture.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailableReason = null;

suite('operational recovery continuity without worker dispatch', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('operational continuity fixture verifies secrets, old leases, and cancellation while queued work remains idle', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
      await bootstrapDatabaseSchemaFromSnapshot({ getPoolFn });
      const fixture = await seedOperationalRecoveryFixture({ getPoolFn });
      const evidence = await verifyRestoredOperationalRecovery({ getPoolFn, fixture });
      assert.deepEqual(evidence, {
        restoredRunCount: 5, restoredSecretCount: 1,
        originalKeyDecrypts: true, missingKeyRejected: true, wrongKeyRejected: true,
        activeLeasePreserved: true, expiredLeasesReleased: 2,
        cancelledRunCount: 2, retryQueuedCount: 1, queuedWorkUnchanged: true,
        workersStarted: false,
      });
    });
  });

  for (const exhausted of [false, true]) {
    test(`cancellation committed after the recovery scan wins over ${exhausted ? 'an exhausted retry budget' : 'automatic retry'}`, {
      timeout: config.scenarioTimeoutMs,
    }, async (t) => {
      if (unavailableReason) { t.skip(unavailableReason); return; }
      await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
        await bootstrapDatabaseSchemaFromSnapshot({ getPoolFn });
        const queryable = getPoolFn();
        const actor = (await queryable.query("INSERT INTO app_users (username, password_hash, role) VALUES ('recovery-operator', 'synthetic-unused-password', 'admin') RETURNING id")).rows[0];
        const run = await seedOperationRunFixture({ queryable, runOverrides: {
          operationType: operationRunRegistry.libraryScan.operationType,
          status: 'running', attemptCount: exhausted ? 3 : 1, maxAttempts: 3,
        } });
        const queue = createOperationQueueStore({ getPoolFn });
        const service = createOperationStrandedRunRecoveryService({
          jobLeaseStore: createJobLeaseStore({ getPoolFn }),
          operationQueueStore: {
            ...queue,
            async listRecoverableRuns(options) {
              const runs = await queue.listRecoverableRuns(options);
              assert.equal(runs[0].cancelRequestedAt, null);
              await queryable.query('UPDATE operation_runs SET cancel_requested_at = NOW(), cancel_requested_by_user_id = $2 WHERE id = $1', [run.id, actor.id]);
              return runs;
            },
          },
        });
        const result = await service.recoverStrandedRuns({ operationTypes: [run.operationType] });
        assert.equal(result.cancelledCount, 1);
        assert.equal(result.retriedCount, 0);
        assert.equal(result.failedCount, 0);
        const persisted = (await queryable.query('SELECT * FROM operation_runs WHERE id = $1', [run.id])).rows[0];
        assert.equal(persisted.status, 'cancelled');
        assert.equal(persisted.cancel_requested_by_user_id, actor.id);
        assert.ok(persisted.cancel_requested_at && persisted.cancelled_at && persisted.finished_at);
        assert.equal(persisted.summary.retryScheduledAt, null);
        assert.equal(await queue.claimNextRunnableRun({ operationTypes: [run.operationType] }), null);
        assert.equal(await queue.recoverRunForRetry({ runId: run.id, nextAttemptAt: new Date().toISOString() }), null);
        const retried = await queue.scheduleRetry({ runId: run.id, maxAttempts: persisted.attempt_count + 1 });
        assert.equal(retried.status, 'pending', 'Only explicit operator retry clears the terminal cancellation');
        assert.equal(retried.cancelRequestedAt, null);
        assert.equal(retried.cancelRequestedByUserId, null);
        assert.equal(retried.cancelledAt, null);
      });
    });
  }
});
