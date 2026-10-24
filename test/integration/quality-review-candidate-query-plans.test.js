/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { before, after, suite, test } from 'node:test';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { loadMigrationManifest } from '../../src/server/migration-manifest.js';
import { bootstrapDatabaseSchemaFromSnapshot } from '../../src/server/schema-bootstrap.js';
import { inspectSchemaAnchors, criticalSchemaAnchors } from '../../src/server/schema-anchor-service.js';
import { renderSchemaSnapshot } from '../../scripts/schema-snapshot.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { candidatePlanIndex, candidatePlanId, qualifyCandidateQueryPlans } from '../../testing/server/quality-review-candidate-plan-fixture.js';
import { createImportCandidateQualityReviewCandidateStore } from '../../src/server/import-candidates/import-candidate-quality-review-candidate-store.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; let upgradedDefinition;
suite('Quality-review candidate access plans and additive schema adoption', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('a populated prior schema upgrades and preserves ordered choices across custom/generic read/lock plans', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
      const pool = getPoolFn(); const manifest = await loadMigrationManifest();
      const indexPosition = manifest.findIndex(migration => /quality_review_candidate_keyset_index\.sql$/u.test(migration.filename));
      assert.ok(indexPosition >= 0);
      await pool.query(renderSchemaSnapshot({ migrations: manifest.slice(0, indexPosition) }));
      const result = await qualifyCandidateQueryPlans({ pool, evidencePath: process.env.HARMONIARR_CANDIDATE_PLAN_EVIDENCE_PATH,
        installIndex: async () => {
          const applied = await applyPendingMigrations({ getPoolFn });
          assert.deepEqual(applied, manifest.slice(indexPosition).map(migration => migration.filename));
        } });
      assert.equal(result.profiles, 224); assert.ok(result.indexBytes > 0);
      const info = (await pool.query(`SELECT indisvalid,indisready,indnkeyatts,indnatts,pg_get_indexdef(indexrelid) AS definition
        FROM pg_index WHERE indexrelid=$1::regclass`, [candidatePlanIndex])).rows[0];
      assert.equal(info.indisvalid, true); assert.equal(info.indisready, true); assert.equal(info.indnkeyatts, 2); assert.equal(info.indnatts, 2);
      upgradedDefinition = info.definition;
      await pool.query("UPDATE import_candidates SET status='selected' WHERE id=$1", [candidatePlanId(5)]);
      await pool.query("UPDATE import_candidates SET status='pending' WHERE id=$1", [candidatePlanId(15)]);
      await pool.query('DELETE FROM import_candidates WHERE id=$1', [candidatePlanId(10)]);
      const store = createImportCandidateQualityReviewCandidateStore({ getPoolFn });
      const ids = (await store.listCandidatePage({ sourceSearchId: 'plan-target' })).map(c => c.id);
      assert.equal(ids[0], candidatePlanId(15)); assert.ok(!ids.includes(candidatePlanId(5))); assert.ok(!ids.includes(candidatePlanId(10)));
      const client = await pool.connect();
      try {
        await client.query('BEGIN'); await client.query("UPDATE import_candidates SET status='held' WHERE id=$1", [candidatePlanId(20)]);
        assert.equal((await store.listCandidatePage({ sourceSearchId: 'plan-target', afterId: candidatePlanId(15), queryable: client }))[0].id, candidatePlanId(20));
      } finally { await client.query('ROLLBACK'); client.release(); }
      assert.notEqual((await store.listCandidatePage({ sourceSearchId: 'plan-target', afterId: candidatePlanId(15) }))[0].id, candidatePlanId(20));
      assert.deepEqual(await applyPendingMigrations({ getPoolFn }), []);
    });
  });

  test('fresh snapshot and upgraded index definitions agree and the schema anchor detects removal', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
      await bootstrapDatabaseSchemaFromSnapshot({ getPoolFn }); const pool = getPoolFn();
      assert.equal((await pool.query('SELECT pg_get_indexdef($1::regclass) AS definition', [candidatePlanIndex])).rows[0].definition, upgradedDefinition);
      assert.ok(criticalSchemaAnchors.indexes.some(anchor => anchor.index === candidatePlanIndex));
      const anchors = { indexes: [{ index: candidatePlanIndex }] };
      const present = await inspectSchemaAnchors({ client: pool, anchors });
      assert.ok(present.indexes[`index.${candidatePlanIndex}`].actual);
      await pool.query(`DROP INDEX ${candidatePlanIndex}`);
      const missing = await inspectSchemaAnchors({ client: pool, anchors });
      assert.equal(missing.indexes[`index.${candidatePlanIndex}`].actual, null);
    });
  });
});
