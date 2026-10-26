/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { ensureSchemaTable } from '/app/server-dist/schema-migration-store.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { createMigrationCliFixture, migrationObserverRole } from '../../testing/server/migration-cli-fixture.js';

await requireDeploymentMemoryProfile();
test('packaged migration diagnostic CLIs observe prepared or invalid state without schema writes and preserve explicit preparation', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(); let fixture, renamed = false, pending, drifted, observer, keyed;
  const cases = [];
  const refusedStartup = [];
  async function refuseStartup(name, pattern, { missing = false } = {}) {
    const before = await fixture.snapshot({ missing });
    const result = await fixture.run('startup', { owner: true });
    assert.equal(result.code, 1, name);
    assert.match(result.stderr, pattern, name);
    assert.doesNotMatch(result.stdout, /listening on/u);
    assert.doesNotMatch(result.stderr, /private-startup-detail|fixture-drift|fixture_unknown|20990202_000001/u);
    assert.deepEqual(await fixture.snapshot({ missing }), before, 'refused startup must not repair lineage');
    refusedStartup.push(name);
  }
  async function cohort(name, codes, pattern, { missing = false } = {}) {
    const before = await fixture.snapshot({ missing });
    const results = await Promise.all(['status', 'checksum', 'diagnose'].map(command => fixture.run(command)));
    assert.deepEqual(results.map(row => row.code), codes, name);
    for (const result of results) assert.doesNotMatch(result.stdout + result.stderr, /Fixture refuses|read-only transaction/u);
    const output = results.map(row => row.stdout + row.stderr);
    if (pattern) assert.match(output.join('\n'), pattern, name);
    assert.deepEqual(await fixture.snapshot({ missing }), before, name + ' must preserve ledger and UUID function identity');
    cases.push({ name, codes, ledgerAndCatalogUnchanged: true }); return results;
  }
  await withWorkerTaskCleanup(async () => {
    fixture = await createMigrationCliFixture(pool);
    await assert.rejects(ensureSchemaTable(pool), error => error.code === '25006');
    observer = new pg.Client({ ...buildConnectionConfig(), user: migrationObserverRole }); await observer.connect();
    const permission = (await observer.query("SELECT current_setting('transaction_read_only') AS readonly,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user")).rows[0];
    assert.deepEqual(permission, { readonly: 'on', rolsuper: false, rolcreatedb: false, rolcreaterole: false }); await observer.end(); observer = null;
    await cohort('current', [0, 0, 0], /115 applied, 0 pending/u);
    const wrapper = await fixture.run('sourceDiagnose'); assert.equal(wrapper.code, 0); assert.match(wrapper.stdout, /Migration state: current/u);
    for (let wave = 0; wave < 3; wave++) await cohort('concurrent-current-' + wave, [0, 0, 0], /115 applied/u);

    pending = (await pool.query("UPDATE schema_migrations SET status='running' WHERE filename=(SELECT filename FROM schema_migrations ORDER BY filename LIMIT 1) RETURNING filename")).rows[0].filename;
    await cohort('pending', [1, 0, 0], /Pending migrations detected:/u);
    await refuseStartup('pending', /Startup migration validation failed: 1 pending/u);
    await pool.query("UPDATE schema_migrations SET status='applied' WHERE filename=$1", [pending]); pending = null;

    drifted = (await pool.query('SELECT filename,checksum FROM schema_migrations ORDER BY filename LIMIT 1')).rows[0];
    await pool.query("UPDATE schema_migrations SET checksum='fixture-drift' WHERE filename=$1", [drifted.filename]);
    await cohort('checksum-drift', [0, 1, 0], /checksum_mismatch/u);
    await refuseStartup('checksum-drift', /1 checksum drift/u);
    await pool.query('UPDATE schema_migrations SET checksum=$2 WHERE filename=$1', [drifted.filename, drifted.checksum]); drifted = null;

    await pool.query("INSERT INTO schema_migrations(migration_key,filename,checksum,status) VALUES ('20990101_000001','20990101_000001_fixture_unknown.sql','fixture','applied')");
    await cohort('unknown-applied', [0, 1, 0], /file_missing/u);
    await refuseStartup('unknown-applied', /1 unknown applied/u);
    await pool.query("DELETE FROM schema_migrations WHERE filename='20990101_000001_fixture_unknown.sql'");

    pending = (await pool.query("UPDATE schema_migrations SET status='failed',error_message='private-startup-detail' WHERE filename=(SELECT filename FROM schema_migrations ORDER BY filename LIMIT 1) RETURNING filename")).rows[0].filename;
    await cohort('failed-row', [1, 0, 0], /1 non-applied row/u);
    await refuseStartup('failed-row', /1 non-applied row/u);
    await pool.query("UPDATE schema_migrations SET status='applied',error_message=NULL WHERE filename=$1", [pending]); pending = null;

    keyed = (await pool.query('SELECT filename,migration_key FROM schema_migrations ORDER BY filename LIMIT 1')).rows[0];
    await pool.query("UPDATE schema_migrations SET migration_key='20990202_000001' WHERE filename=$1", [keyed.filename]);
    await cohort('migration-key-drift', [0, 0, 0], /1 migration key drift/u);
    await refuseStartup('migration-key-drift', /1 migration key drift/u);
    await pool.query('UPDATE schema_migrations SET migration_key=$2 WHERE filename=$1', [keyed.filename, keyed.migration_key]); keyed = null;

    await fixture.guard.setEnabled(false); await pool.query(`REVOKE SELECT ON TABLE schema_migrations FROM ${migrationObserverRole}`); await fixture.guard.setEnabled(true);
    await cohort('permission-denied', [1, 1, 1], /permission denied/u);
    await fixture.guard.setEnabled(false); await pool.query(`GRANT SELECT ON TABLE schema_migrations TO ${migrationObserverRole}`); await fixture.guard.setEnabled(true);

    await fixture.guard.setEnabled(false); await pool.query('ALTER TABLE schema_migrations RENAME TO fixture_cli_missing_migrations'); renamed = true; await fixture.guard.setEnabled(true);
    await cohort('missing-ledger', [1, 1, 1], /relation "schema_migrations" does not exist/u, { missing: true });
    assert.equal((await pool.query("SELECT to_regclass('public.schema_migrations') AS name")).rows[0].name, null);
    await refuseStartup('missing-ledger', /relation "schema_migrations" does not exist/u, { missing: true });
    await fixture.guard.setEnabled(false); await pool.query('ALTER TABLE fixture_cli_missing_migrations RENAME TO schema_migrations'); renamed = false;

    const prepared = await fixture.run('migrate', { owner: true }); assert.equal(prepared.code, 0); assert.match(prepared.stdout, /applied 0 migration\(s\)/u);
    await fixture.guard.setEnabled(true); const before = await fixture.snapshot();
    const refusedPreparation = await fixture.run('migrate'); assert.equal(refusedPreparation.code, 1);
    assert.deepEqual(await fixture.snapshot(), before); await cohort('restored-current', [0, 0, 0], /Migration state: current/u);
    t.diagnostic(JSON.stringify({ cases, refusedStartup, readOnlyRestrictedRole: true, sourceWrapper: true, explicitPreparation: true,
      refusedRestrictedPreparation: true, pendingStartupFatalBeforeListen: true, missingStartupFatalBeforeListen: true, actualChildClose: true }));
  }, async () => {
    await withWorkerTaskCleanup(async () => {
      if (fixture) await fixture.guard.setEnabled(false);
      if (renamed) await pool.query('ALTER TABLE fixture_cli_missing_migrations RENAME TO schema_migrations');
      if (pending) await pool.query("UPDATE schema_migrations SET status='applied',error_message=NULL WHERE filename=$1", [pending]);
      if (drifted) await pool.query('UPDATE schema_migrations SET checksum=$2 WHERE filename=$1', [drifted.filename, drifted.checksum]);
      if (keyed) await pool.query('UPDATE schema_migrations SET migration_key=$2 WHERE filename=$1', [keyed.filename, keyed.migration_key]);
    }, async () => { await withWorkerTaskCleanup(async () => { if (observer) await observer.end(); }, closePool); });
  });
});
