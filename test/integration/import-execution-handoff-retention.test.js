import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationRunStore, countPrunableOperationRuns, pruneOperationRunsLedger } from '../../src/server/operation-run-store.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { operationRunRegistry } from '../../src/shared/operation-run-descriptors.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

async function withRetentionHistory(run) {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const candidate = await seedImportCandidateFixture({ queryable: pool });
    const operations = createOperationRunStore({ getPoolFn,
      operationType: operationRunRegistry.importCandidateExecutionPlanning.operationType });
    const retained = [];
    const reclaimable = [];
    for (const [handoffState, itemStatus, keep] of [
      ['dispatching', 'blocked', true],
      ['awaiting_confirmation', 'awaiting_confirmation', true],
      [null, 'awaiting_confirmation', true],
      ['confirmed', 'queued', false],
      ['not_dispatched', 'awaiting_confirmation', false],
      [null, null, false],
    ]) {
      const operation = await operations.createOperationRun({ status: 'failed',
        summary: { executionMode: 'download_enqueue', triggerSource: 'manual' } });
      (keep ? retained : reclaimable).push(operation.id);
      if (itemStatus) await pool.query(`INSERT INTO import_execution_run_items
        (operation_run_id,import_candidate_id,position,item_status,status_message,planning_snapshot)
        VALUES ($1,$2,1,$3,'Controlled handoff checkpoint',$4::jsonb)`, [operation.id, candidate.id, itemStatus,
      JSON.stringify({ execution: handoffState ? { handoff: { state: handoffState } } : {} })]);
    }
    await pool.query(`UPDATE operation_runs SET created_at=NOW()-INTERVAL '30 days',
      started_at=NOW()-INTERVAL '30 days',finished_at=NOW()-INTERVAL '30 days'
      WHERE id=ANY($1::uuid[])`, [[...retained, ...reclaimable]]);
    // Retention protects unresolved acceptance even if a later action changed candidate phase.
    await pool.query("UPDATE import_candidates SET status='failed' WHERE id=$1", [candidate.id]);
    const keeper = await operations.createOperationRun({ status: 'completed', summary: {} });
    await run({ pool, getPoolFn, operations, retained, reclaimable, keeper });
  } });
}

async function assertHistory({ operations, retained, reclaimable, keeper }) {
  for (const id of retained) assert.equal((await operations.getRunById(id))?.id, id);
  for (const id of reclaimable) assert.equal(await operations.getRunById(id), null);
  assert.equal((await operations.getRunById(keeper.id))?.id, keeper.id);
}

test('per-type pruning retains manual/legacy unresolved checkpoints and reclaims known resolved history',
  { timeout: 60_000 }, async () => {
    await withRetentionHistory(async (history) => {
      await history.operations.pruneOldRuns({ retainCount: 1 });
      await assertHistory(history);
      const rows = await history.pool.query('SELECT item_status FROM import_execution_run_items');
      assert.equal(rows.rowCount, 3);
    });
  });

test('global retention preview and deletion agree while preserving uncertain provider intent',
  { timeout: 60_000 }, async () => {
    await withRetentionHistory(async (history) => {
      const options = { getPoolFn: history.getPoolFn,
        olderThanIso: new Date(Date.now() - 7 * 86_400_000).toISOString(), retainCountPerType: 1 };
      assert.deepEqual(await countPrunableOperationRuns(options), { prunableCount: 3 });
      assert.deepEqual(await pruneOperationRunsLedger(options), { prunedCount: 3 });
      await assertHistory(history);
      assert.deepEqual(await countPrunableOperationRuns(options), { prunableCount: 0 });
    });
  });
