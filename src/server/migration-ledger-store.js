/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const version = () => process.env.HARMONIARR_VERSION ?? process.env.npm_package_version ?? null;
export async function beginMigrationReceipt(client, migration, startedAt) {
  await client.query(`
    INSERT INTO schema_migrations (migration_key,filename,description,checksum,status,started_at,application_version,updated_at)
    VALUES ($1,$2,$3,$4,'running',$5,$6,NOW())
    ON CONFLICT (filename) DO UPDATE SET migration_key=EXCLUDED.migration_key,description=EXCLUDED.description,
      checksum=EXCLUDED.checksum,status='running',started_at=EXCLUDED.started_at,finished_at=NULL,
      duration_ms=NULL,error_message=NULL,application_version=EXCLUDED.application_version,updated_at=NOW()
  `, [migration.migrationKey, migration.filename, migration.description, migration.checksum, startedAt, version()]);
}
export async function finishMigrationReceipt(client, migration, startedAt) {
  const result = await client.query(`
    UPDATE schema_migrations SET status='applied',finished_at=NOW(),duration_ms=$2,error_message=NULL,updated_at=NOW()
    WHERE filename=$1
  `, [migration.filename, Date.now() - startedAt.getTime()]);
  if (result.rowCount !== 1) throw Object.assign(new Error('Migration applied receipt was not written.'), { code: 'migration_receipt_missing' });
}
export async function recordFailedMigrationReceipt(client, migration, startedAt, failure) {
  await client.query(`
    INSERT INTO schema_migrations
      (migration_key,filename,description,checksum,status,started_at,finished_at,duration_ms,error_message,application_version,updated_at)
    VALUES ($1,$2,$3,$4,'failed',$5,NOW(),$6,$7,$8,NOW())
    ON CONFLICT (filename) DO UPDATE SET status='failed',finished_at=NOW(),duration_ms=$6,error_message=$7,
      checksum=EXCLUDED.checksum,application_version=$8,updated_at=NOW()
  `, [migration.migrationKey, migration.filename, migration.description, migration.checksum, startedAt,
    Date.now() - startedAt.getTime(), failure instanceof Error ? failure.message : String(failure), version()]);
}
