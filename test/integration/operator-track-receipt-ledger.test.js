/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createOperatorTrackReceiptStore } from '../../src/server/metadata/operator-track-receipt-store.js';
import { buildTrackReceipt, seedTrackReceiptCandidate, seedReceiptLookupHistory, legacyTrackReceiptQuery } from '../../testing/integration/operator-track-receipt-fixture.js';
import { withRollbackFixtureClient } from '../../testing/integration/fixture-transaction-client.js';
import { bootstrapDatabaseSchemaFromSnapshot } from '../../src/server/schema-bootstrap.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const migration = '20261012_222007_operator_track_receipt_ledger.sql';
const rows = async pool => (await pool.query('SELECT * FROM operator_track_receipts ORDER BY import_candidate_id,app_user_id')).rows;

suite('Candidate-owned indexed historical track receipts', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('pending migration backfills complete supported history without granting malformed or pending receipts', { timeout: config.scenarioTimeoutMs }, async () => runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn }); const pool = getPoolFn();
    // Only this invocation's acknowledged fresh database is changed to its
    // pre-ledger state; the real migration runner then owns the upgrade.
    await pool.query(`DROP TABLE operator_track_receipt_invalidations;
      DROP TRIGGER import_candidates_track_receipts ON import_candidates;
      DROP TABLE operator_track_receipts;
      DROP FUNCTION sync_operator_track_receipts(); DROP FUNCTION operator_track_receipt_rows(jsonb);`);
    await pool.query('DELETE FROM schema_migrations WHERE filename=ANY($1::text[])',
      [[migration, '20261012_225951_scan_owned_receipt_invalidation.sql']]);
    const first = buildTrackReceipt(); const peer = buildTrackReceipt({ metadataReleaseId: first.scope.metadataReleaseId });
    const single = await seedTrackReceiptCandidate(pool, first);
    const shared = await seedTrackReceiptCandidate(pool, { version: 2, receipts: [first, peer] });
    await seedTrackReceiptCandidate(pool, first, 'import_pending');
    for (const invalid of [null, [], { version: 7 }, { ...first, ownerId: 'invalid' },
      { version: 2, receipts: [first] }, { version: 2, receipts: [first, peer, peer] },
      { version: 2, receipts: [first, first] }, { version: 2, receipts: [first, { ...peer, ownerId: null }] },
      { version: 2, receipts: [first, buildTrackReceipt()] }]) await seedTrackReceiptCandidate(pool, invalid);
    await applyPendingMigrations({ getPoolFn }); const saved = await rows(pool);
    assert.equal(saved.length, 3);
    assert.equal(saved.filter(row => row.import_candidate_id === shared.id).length, 2);
    assert.deepEqual(saved.find(row => row.import_candidate_id === single.id).receipt, first);
    await applyPendingMigrations({ getPoolFn }); assert.deepEqual(await rows(pool), saved);
    const store = createOperatorTrackReceiptStore({ getPoolFn });
    const selected = await store.listFulfillment({ ownerId: peer.ownerId, metadataReleaseIds: [first.scope.metadataReleaseId] });
    assert.deepEqual(selected, [{ ...peer, importCandidateId: shared.id }]);
    assert.deepEqual(await store.listFulfillment({ ownerId: randomUUID(), metadataReleaseIds: [first.scope.metadataReleaseId] }), []);
  }));

  test('candidate transaction, required event, replacement and deletion own ledger visibility', { timeout: config.scenarioTimeoutMs }, async () => runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn }); const pool = getPoolFn(); const first = buildTrackReceipt();
    const candidate = await seedTrackReceiptCandidate(pool, first, 'import_pending');
    await withRollbackFixtureClient(pool, async client => {
      await client.query("UPDATE import_candidates SET status='applied' WHERE id=$1", [candidate.id]);
      assert.equal((await rows(client)).length, 1); assert.equal((await rows(pool)).length, 0);
      await assert.rejects(client.query(`INSERT INTO import_candidate_events(import_candidate_id,event_type,previous_status,new_status,details)
        VALUES($1,'fixture_required_event',NULL,'applied',NULL)`, [candidate.id]), { code: '23502' });
      await client.query('ROLLBACK'); assert.equal((await rows(pool)).length, 0);
      assert.equal((await pool.query('SELECT status FROM import_candidates WHERE id=$1', [candidate.id])).rows[0].status, 'import_pending');
      await client.query('BEGIN');
      await client.query("UPDATE import_candidates SET status='applied' WHERE id=$1", [candidate.id]);
      await client.query('COMMIT'); assert.equal((await rows(pool)).length, 1);
      // Unrelated candidate progress must not rewrite receipt evidence.
      const witness = (await pool.query('SELECT xmin::text FROM operator_track_receipts')).rows[0].xmin;
      await pool.query("UPDATE import_candidates SET normalized_payload=normalized_payload || '{\"unrelated\":true}'::jsonb WHERE id=$1", [candidate.id]);
      assert.equal((await pool.query('SELECT xmin::text FROM operator_track_receipts')).rows[0].xmin, witness);
      const replacement = buildTrackReceipt();
      await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_build_object('operatorTrackFulfillment',$2::jsonb) WHERE id=$1", [candidate.id, JSON.stringify(replacement)]);
      assert.deepEqual((await rows(pool))[0].receipt, replacement);
      await assert.rejects(pool.query("UPDATE operator_track_receipts SET receipt='{}'::jsonb"), { code: '23514' });
      await pool.query("UPDATE import_candidates SET status='rejected' WHERE id=$1", [candidate.id]); assert.equal((await rows(pool)).length, 0);
      await pool.query("UPDATE import_candidates SET status='applied' WHERE id=$1", [candidate.id]); assert.equal((await rows(pool)).length, 1);
      await pool.query('DELETE FROM import_candidates WHERE id=$1', [candidate.id]); assert.equal((await rows(pool)).length, 0);
    });
  }));

  test('snapshot bootstrap installs the same receipt projection and current migration lineage', { timeout: config.scenarioTimeoutMs }, async () => runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    const bootstrapped = await bootstrapDatabaseSchemaFromSnapshot({ getPoolFn });
    assert.equal(bootstrapped.bootstrapped, true); const pool = getPoolFn();
    const receipt = buildTrackReceipt(); const candidate = await seedTrackReceiptCandidate(pool, receipt);
    assert.deepEqual(await createOperatorTrackReceiptStore({ getPoolFn }).listFulfillment({ ownerId: receipt.ownerId,
      metadataReleaseIds: [receipt.scope.metadataReleaseId] }), [{ ...receipt, importCandidateId: candidate.id }]);
    const state = (await pool.query('SELECT status FROM schema_migrations WHERE filename=$1', [migration])).rows[0];
    assert.equal(state.status, 'applied');
    await applyPendingMigrations({ getPoolFn }); assert.equal((await rows(pool)).length, 1);
  }));

  test('matched legacy and indexed lookups select identical owned history with planner-chosen evidence', { timeout: config.scenarioTimeoutMs }, async () => runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn }); const pool = getPoolFn(); const receipt = await seedReceiptLookupHistory(pool);
    const params = [receipt.ownerId, [receipt.scope.metadataReleaseId]]; let indexedSql;
    const store = createOperatorTrackReceiptStore({ getPoolFn });
    const queryable = { query: (sql, values) => { indexedSql = sql; return pool.query(sql, values); } };
    const legacy = async () => (await pool.query(legacyTrackReceiptQuery, params)).rows.map(row => ({ ...row.receipt, importCandidateId: row.import_candidate_id }));
    const indexed = () => store.listFulfillment({ ownerId: receipt.ownerId, metadataReleaseIds: params[1], queryable });
    const durations = { legacy: [], indexed: [] };
    for (let pair = 0; pair < 6; pair++) for (const [name, lookup] of (pair % 2 ? [['indexed', indexed], ['legacy', legacy]] : [['legacy', legacy], ['indexed', indexed]])) {
      const started = performance.now(); const result = await lookup(); durations[name].push(performance.now() - started);
      assert.equal(result.length, 1); assert.deepEqual(result[0], { ...receipt, importCandidateId: result[0].importCandidateId });
      assert.deepEqual(await legacy(), await indexed());
    }
    const plans = {};
    for (const [name, sql] of [['legacy', legacyTrackReceiptQuery], ['indexed', indexedSql]]) {
      const evidence = (await pool.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ' + sql, params)).rows[0]['QUERY PLAN'][0];
      plans[name] = { executionMs: evidence['Execution Time'], blocks: evidence.Plan['Shared Hit Blocks'],
        rootNode: evidence.Plan['Node Type'], nodes: JSON.stringify(evidence.Plan, (key, value) => key === 'Index Cond' || key === 'Filter' ? undefined : value) };
    }
    assert.equal((await rows(pool)).length, 10001);
    console.log('[receipt-lookup-measurement]', JSON.stringify({ candidateRows: 10001, durationsMs: durations,
      plans: Object.fromEntries(Object.entries(plans).map(([name, value]) => [name, { executionMs: value.executionMs, blocks: value.blocks, rootNode: value.rootNode }])),
      indexedOwnerReleaseIndexObserved: plans.indexed.nodes.includes('operator_track_receipts_owner_release_idx') }));
  }));
});
