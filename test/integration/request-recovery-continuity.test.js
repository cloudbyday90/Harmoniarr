/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { bootstrapDatabaseSchemaFromSnapshot } from '../../src/server/schema-bootstrap.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { seedRequestRecoveryFixture } from '../../testing/recovery/request-recovery-fixture.js';
import { captureRequestRecoverySnapshot, verifyRestoredRequestRecovery } from '../../testing/recovery/request-recovery-verification.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailableReason;

suite('request recovery continuity domain verification', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('verifies exact request ledgers and resumes only retained work through injected services', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
      await bootstrapDatabaseSchemaFromSnapshot({ getPoolFn });
      const fixture = await seedRequestRecoveryFixture({ getPoolFn });
      const expectedSnapshot = await captureRequestRecoverySnapshot({ queryable: getPoolFn(), fixture });
      const result = await verifyRestoredRequestRecovery({ getPoolFn, fixture, expectedSnapshot });
      assert.equal(result.restoredRequestCount, 2);
      assert.equal(result.restoredCollectionCount, 2);
      assert.equal(result.restoredDecisionCount, 3);
      assert.equal(result.restoredProviderWorkCount, 9);
      assert.equal(result.restoredIntentCount, 1);
      assert.equal(result.restoredOperationRunCount, 6);
      assert.equal(result.finalizedCollectionCount, 2);
      assert.equal(result.resumedWorkCount, 4);
      assert.equal(result.providerNetworkRequests, 0);
      assert.equal(result.acquisitionOperationsExecuted, 0);
      assert.ok(Object.values(result).every((value) => typeof value === 'boolean' ? value : Number.isSafeInteger(value)));
    });
  });

  test('rejects changed review decisions before resuming any queued work', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
      await bootstrapDatabaseSchemaFromSnapshot({ getPoolFn });
      const fixture = await seedRequestRecoveryFixture({ getPoolFn });
      const expectedSnapshot = await captureRequestRecoverySnapshot({ queryable: getPoolFn(), fixture });
      await getPoolFn().query(`UPDATE library_external_request_collection_items SET exclusion_reason = 'Changed after backup'
        WHERE media_request_id = $1 AND decision = 'excluded'`, [fixture.reviewedRequestId]);
      await assert.rejects(verifyRestoredRequestRecovery({ getPoolFn, fixture, expectedSnapshot }), {
        message: 'Restored request ledger differs from the backup source',
      });
      const current = await captureRequestRecoverySnapshot({ queryable: getPoolFn(), fixture });
      assert.ok(isDeepStrictEqual(current.work, expectedSnapshot.work), 'Failed verification leaves provider work unchanged.');
      assert.ok(isDeepStrictEqual(current.runs, expectedSnapshot.runs), 'Failed verification leaves queued operations unchanged.');
    });
  });
});
