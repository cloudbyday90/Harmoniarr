/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { before, after, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { loadMigrationManifest } from '../../src/server/migration-manifest.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { bootstrapDatabaseSchemaFromSnapshot } from '../../src/server/schema-bootstrap.js';
import { inspectSchemaAnchors, criticalSchemaAnchors } from '../../src/server/schema-anchor-service.js';
import { renderSchemaSnapshot } from '../../scripts/schema-snapshot.js';
import { qualifyCandidateSearchRevisions } from '../../testing/server/candidate-search-revision-fixture.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
suite('Durable candidate search revisions', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('populated upgrade backfills every source and installs enabled anchored guards atomically', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
      const pool = getPoolFn(); const manifest = await loadMigrationManifest();
      const position = manifest.findIndex(item => /candidate_search_revisions\.sql$/u.test(item.filename)); assert.ok(position > 0);
      await pool.query(renderSchemaSnapshot({ migrations: manifest.slice(0, position) }));
      await pool.query(`INSERT INTO import_candidates(source_provider,source_search_id,source_response_key,username,folder_path,raw_payload,normalized_payload,discovered_at)
        SELECT 'prior','prior-'||n,n::text,'fixture','/fixture','{}','{}',NOW() FROM generate_series(1,3) n`);
      assert.deepEqual(await applyPendingMigrations({ getPoolFn }), manifest.slice(position).map(item => item.filename));
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM import_candidate_search_revisions')).rows[0].count, 3);
      const anchors = { triggers: criticalSchemaAnchors.triggers.filter(a => a.table === 'import_candidates') };
      assert.equal(anchors.triggers.length, 4);
      const present = await inspectSchemaAnchors({ client: pool, anchors });
      for (const row of Object.values(present.triggers)) assert.ok(row.actual);
      await pool.query('ALTER TABLE import_candidates DISABLE TRIGGER import_candidates_search_revision_update');
      assert.equal((await inspectSchemaAnchors({ client: pool, anchors })).triggers['trigger.import_candidates.import_candidates_search_revision_update'].actual, null);
      assert.deepEqual(await applyPendingMigrations({ getPoolFn }), []);
    });
  });
  test('fresh snapshot qualifies mutations, committed reads, actual writer contention and rollback', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
      await bootstrapDatabaseSchemaFromSnapshot({ getPoolFn });
      const evidence = await qualifyCandidateSearchRevisions({ pool: getPoolFn() }); assert.equal(evidence.observedWriterWait, true);
    });
  });
});
