/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  schemaIdDefaultExpression,
  schemaIdFunctionSql,
  schemaIdPgcryptoSql,
} from './schema-id-function.js';

export const schemaMigrationsTableSql = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id UUID PRIMARY KEY DEFAULT ${schemaIdDefaultExpression},
  migration_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL UNIQUE,
  description TEXT NULL,
  checksum TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  duration_ms INTEGER NULL,
  error_message TEXT NULL,
  application_version TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`.trim();

export async function ensureSchemaTable(client) {
  await client.query(schemaIdPgcryptoSql);
  await client.query(schemaIdFunctionSql);
  await client.query(schemaMigrationsTableSql);
}

export async function getAppliedMigrationFilenames(client) {
  const result = await client.query(
    "SELECT filename FROM schema_migrations WHERE status = 'applied' ORDER BY filename ASC",
  );
  return new Set(result.rows.map((row) => row.filename));
}

export async function getAppliedMigrationChecksums(client) {
  const result = await client.query(
    "SELECT filename, checksum FROM schema_migrations WHERE status = 'applied' ORDER BY filename ASC",
  );
  return result.rows.map((row) => ({ filename: row.filename, storedChecksum: row.checksum }));
}

export async function getDatabaseMigrationRows(client) {
  const result = await client.query(`
    SELECT filename, checksum, status, migration_key, error_message
    FROM schema_migrations
    ORDER BY filename ASC
  `);
  return result.rows;
}

export async function getMigrationPreparationSchemaState(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='schema_migrations' AND c.relkind='r'
    ) AS ledger_present,
    (SELECT count(*)::integer FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','f','v','m','S')) AS relation_count
  `);
  return result.rows[0];
}
