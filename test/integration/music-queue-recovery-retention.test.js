/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createOperationRunStore, countPrunableOperationRuns, pruneOperationRunsLedger } from '../../src/server/operation-run-store.js';
import { operationRunRegistry } from '../../src/shared/operation-run-descriptors.js';
import { createMusicQueueRecoveryFixtureContext, seedMusicQueueRecoveryFixture, recoverMusicQueueFixture }
  from '../../testing/integration/music-queue-recovery-fixtures.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime; let unavailableReason;

async function scenario(t, run) {
  if (unavailableReason) { t.skip(unavailableReason); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const context = createMusicQueueRecoveryFixtureContext({ getPoolFn });
    const f = await seedMusicQueueRecoveryFixture(context);
    const decision = await recoverMusicQueueFixture(context, f, 'rejected');
    assert.equal(decision.scopedRecoveryQueued, true);
    const descriptor = operationRunRegistry.importCandidateExecutionPlanning;
    const operations = createOperationRunStore({ getPoolFn, operationType: descriptor.operationType, leaseJobType: descriptor.leaseJobType });
    await operations.markRunCompleted({ runId: decision.recoveryRunId, summary: { currentStep: 'Controlled terminal run' } });
    const protectedRun = await operations.getRunById(decision.recoveryRunId);
    assert.equal(protectedRun.summary.musicQueueRecovery.retired, undefined);
    const ordinary = await operations.createOperationRun({ status: 'completed', summary: {} });
    const retired = await operations.createOperationRun({ status: 'completed', summary: { ...protectedRun.summary,
      musicQueueRecovery: { ...protectedRun.summary.musicQueueRecovery, retired: true } } });
    const oldIds = [protectedRun.id, ordinary.id, retired.id];
    await context.pool.query(`UPDATE operation_runs SET created_at=NOW()-INTERVAL '30 days',
      started_at=NOW()-INTERVAL '30 days',finished_at=NOW()-INTERVAL '30 days' WHERE id=ANY($1::uuid[])`, [oldIds]);
    const keeper = await operations.createOperationRun({ status: 'completed', summary: {} });
    await run({ ...context, operations, protectedRun, ordinary, retired, keeper });
  });
}

suite('Recovery reservation retention with isolated PostgreSQL', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailableReason = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('per-type pruning retains protected recovery and reclaims ordinary missing-source and retired history', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async ({ operations, protectedRun, ordinary, retired, keeper }) => {
      await operations.pruneOldRuns({ retainCount: 1 });
      assert.equal(await operations.getRunById(ordinary.id), null);
      assert.equal(await operations.getRunById(retired.id), null);
      assert.equal((await operations.getRunById(protectedRun.id)).id, protectedRun.id);
      assert.equal((await operations.getRunById(keeper.id)).id, keeper.id);
    });
  });

  test('global age/count preview and mutation agree without releasing protected recovery authority', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async ({ getPoolFn, operations, protectedRun, ordinary, retired, keeper }) => {
      const options = { getPoolFn, olderThanIso: new Date(Date.now() - 7 * 86_400_000).toISOString(), retainCountPerType: 1 };
      assert.deepEqual(await countPrunableOperationRuns(options), { prunableCount: 2 });
      assert.deepEqual(await pruneOperationRunsLedger(options), { prunedCount: 2 });
      assert.equal(await operations.getRunById(ordinary.id), null);
      assert.equal(await operations.getRunById(retired.id), null);
      assert.equal((await operations.getRunById(protectedRun.id)).id, protectedRun.id);
      assert.equal((await operations.getRunById(keeper.id)).id, keeper.id);
      assert.deepEqual(await countPrunableOperationRuns(options), { prunableCount: 0 });
    });
  });
});
