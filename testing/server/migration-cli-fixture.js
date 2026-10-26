/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { createMigrationObservationGuard } from './migration-observation-fixture.js';

export const migrationObserverRole = 'fixture_migration_cli_reader';
const entries = Object.freeze({ status: '/app/server-dist/check-migrations.js', checksum: '/app/server-dist/check-migration-checksums.js',
  diagnose: '/app/server-dist/diagnose-migrations.js', sourceDiagnose: '/app/scripts/diagnose-migrations.js',
  migrate: '/app/server-dist/migrate.js', retryMigrate: '/app/server-dist/migrate.js',
  prepare: '/app/server-dist/prepare-database.js', startup: '/app/server-dist/index.js' });
const execute = promisify(execFile);

/** Own only fixture roles/guard in a database already admitted by the native profile. */
export async function createMigrationCliFixture(pool) {
  await pool.query(`CREATE ROLE ${migrationObserverRole} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);
  await pool.query(`GRANT USAGE ON SCHEMA public TO ${migrationObserverRole}`);
  await pool.query(`GRANT SELECT ON TABLE schema_migrations TO ${migrationObserverRole}`);
  await pool.query(`ALTER ROLE ${migrationObserverRole} SET default_transaction_read_only=on`);
  const guard = await createMigrationObservationGuard(pool);
  async function run(command, { owner = false } = {}) {
    assert.ok(Object.hasOwn(entries, command));
    const env = { ...process.env, HARMONIARR_TEST_DISABLE_BACKGROUND_SERVICES: 'true',
      PGUSER: owner ? process.env.PGUSER : migrationObserverRole };
    try {
      const result = await execute(process.execPath, [entries[command], ...(command === 'retryMigrate' ? ['--retry-failed'] : [])], { env, timeout: 20_000, maxBuffer: 64 * 1024, windowsHide: true });
      return { code: 0, ...result };
    } catch (error) {
      assert.equal(error.killed, false, 'diagnostic must finish rather than expire'); assert.equal(error.signal, null);
      assert.equal(typeof error.code, 'number');
      return { code: error.code, stdout: error.stdout, stderr: error.stderr };
    }
  }
  async function snapshot({ missing = false } = {}) {
    const rows = (await pool.query(missing
      ? 'SELECT row_to_json(s) AS row FROM fixture_cli_missing_migrations s ORDER BY filename'
      : 'SELECT row_to_json(s) AS row FROM schema_migrations s ORDER BY filename')).rows;
    return { ledger: createHash('sha256').update(JSON.stringify(rows)).digest('hex'), catalog: await guard.getCatalogIdentity() };
  }
  return { guard, run, snapshot };
}
