/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getPool, closePool } from '/app/server-dist/database.js';
import { createMigrationObservationGuard } from './migration-observation-fixture.js';

const scenario = process.argv[2];
assert.ok(['checksum', 'key', 'unknown', 'failed', 'missing', 'pending', 'retry'].includes(scenario));
assert.equal(process.env.PGDATABASE, 'harmoniarr_backup_pg_crash_qualification');
assert.equal(process.env.PGDATA, '/app/data/postgres/18/data');
assert.equal(process.env.PGHOST, '127.0.0.1');
const pool = getPool();
try {
  if (scenario === 'checksum') await pool.query("UPDATE schema_migrations SET checksum='private-preparation-checksum' WHERE filename=(SELECT filename FROM schema_migrations ORDER BY filename LIMIT 1)");
  if (scenario === 'key') await pool.query("UPDATE schema_migrations SET migration_key='20990101_000001' WHERE filename=(SELECT filename FROM schema_migrations ORDER BY filename LIMIT 1)");
  if (scenario === 'unknown') await pool.query("INSERT INTO schema_migrations(migration_key,filename,checksum,status) VALUES('20990101_000001','20990101_000001_private_unknown.sql','private','applied')");
  if (scenario === 'failed') await pool.query("UPDATE schema_migrations SET status='failed',error_message='private-preparation-error' WHERE filename=(SELECT filename FROM schema_migrations ORDER BY filename DESC LIMIT 1)");
  if (scenario === 'missing') await pool.query('ALTER TABLE schema_migrations RENAME TO fixture_preparation_hidden_ledger');
  if (scenario === 'pending') {
    await pool.query('DROP INDEX operation_runs_active_quality_review_search_idx');
    await pool.query("DELETE FROM schema_migrations WHERE filename='20261024_145328_quality_review_search_qualification.sql'");
  }
  if (scenario === 'retry') {
    await pool.query('DROP INDEX operation_runs_active_quality_review_search_idx');
    await pool.query("UPDATE schema_migrations SET status='failed' WHERE filename='20261024_145328_quality_review_search_qualification.sql'");
  }
  const rows = (await pool.query(scenario === 'missing'
    ? 'SELECT row_to_json(s) AS row FROM fixture_preparation_hidden_ledger s ORDER BY filename'
    : 'SELECT row_to_json(s) AS row FROM schema_migrations s ORDER BY filename')).rows;
  // The real entrypoint must refuse on its own preflight, before this DDL tripwire.
  if (!['pending', 'retry'].includes(scenario)) await createMigrationObservationGuard(pool);
  console.log('MIGRATION_PREPARATION_FIXTURE ' + JSON.stringify({ scenario, rows: rows.length,
    ledgerSha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') }));
} finally { await closePool(); }
