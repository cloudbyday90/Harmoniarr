import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportExecutionTransferLinkStore } from '../../src/server/import-candidates/import-execution-transfer-link-store.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { operationRunRegistry } from '../../src/shared/operation-run-descriptors.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { seedOperationRunFixture } from '../../testing/integration/operation-run-fixtures.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

async function seedExecutionItem({ candidateId, operationRunId, pool }) {
  const result = await pool.query(
    `
      INSERT INTO import_execution_run_items (
        operation_run_id,
        import_candidate_id,
        position,
        item_status,
        status_message,
        planning_snapshot
      )
      VALUES ($1, $2, 1, 'queued', 'Transfer accepted by slskd.', '{}'::jsonb)
      RETURNING id
    `,
    [operationRunId, candidateId],
  );

  return result.rows[0].id;
}

test('confirmed transfer links preserve exact execution ownership in PostgreSQL', {
  timeout: 60_000,
}, async () => {
  await withDockerizedPostgresDatabase({
    run: async ({ getPoolFn }) => {
      await applyPendingMigrations({ getPoolFn });

      const pool = getPoolFn();
      const firstCandidate = await seedImportCandidateFixture({
        candidateOverrides: {
          sourceSearchId: 'execution-transfer-link-search-1',
          sourceResponseKey: 'execution-transfer-link-response-1',
          username: 'source-user',
        },
        queryable: pool,
      });
      const firstRun = await seedOperationRunFixture({
        queryable: pool,
        runOverrides: {
          operationType: operationRunRegistry.importCandidateExecutionPlanning.operationType,
          status: 'completed',
        },
      });
      const firstItemId = await seedExecutionItem({
        candidateId: firstCandidate.id,
        operationRunId: firstRun.id,
        pool,
      });
      const store = createImportExecutionTransferLinkStore({ getPoolFn });

      const links = await store.recordConfirmedTransfers({
        importCandidateId: firstCandidate.id,
        operationRunId: firstRun.id,
        transfers: [{ id: 'transfer-1', username: 'source-user' }],
      });

      assert.equal(links.length, 1);
      assert.equal(links[0].importExecutionRunItemId, firstItemId);
      const persisted = await pool.query(
        `
          SELECT import_execution_run_item_id, operation_run_id, import_candidate_id
          FROM import_execution_transfer_links
          WHERE provider = 'slskd'
            AND source_username = 'source-user'
            AND provider_transfer_id = 'transfer-1'
        `,
      );
      assert.deepEqual(persisted.rows, [{
        import_execution_run_item_id: firstItemId,
        operation_run_id: firstRun.id,
        import_candidate_id: firstCandidate.id,
      }]);

      const secondCandidate = await seedImportCandidateFixture({
        candidateOverrides: {
          sourceSearchId: 'execution-transfer-link-search-2',
          sourceResponseKey: 'execution-transfer-link-response-2',
          username: 'source-user',
        },
        queryable: pool,
      });
      const secondRun = await seedOperationRunFixture({
        queryable: pool,
        runOverrides: {
          operationType: operationRunRegistry.importCandidateExecutionPlanning.operationType,
          status: 'completed',
        },
      });
      await seedExecutionItem({
        candidateId: secondCandidate.id,
        operationRunId: secondRun.id,
        pool,
      });

      await assert.rejects(
        () => store.recordConfirmedTransfers({
          importCandidateId: secondCandidate.id,
          operationRunId: secondRun.id,
          transfers: [{ id: 'transfer-1', username: 'source-user' }],
        }),
        (error) => error?.code === 'import_execution_transfer_link_conflict',
      );
    },
  });
});
