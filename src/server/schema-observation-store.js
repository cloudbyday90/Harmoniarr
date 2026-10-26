/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { databasePreparationLockKey } from './database-preparation-lock-store.js';

export async function trySchemaObservationLock(client) {
  const result = await client.query('SELECT pg_catalog.pg_try_advisory_xact_lock_shared($1::integer,$2::integer) AS acquired', databasePreparationLockKey);
  return result.rows[0]?.acquired;
}

export async function readObservedMigrationRows(client, limit) {
  const result = await client.query(`SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='schema_migrations' AND c.relkind='r') AS present`);
  if (result.rows[0]?.present !== true) return { present: false, rows: [] };
  const rows = await client.query(`SELECT filename, checksum, status, migration_key
    FROM public.schema_migrations ORDER BY filename ASC LIMIT $1::integer`, [limit]);
  return { present: true, rows: rows.rows };
}
