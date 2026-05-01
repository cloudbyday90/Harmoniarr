/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadMigrationManifest } from '../src/server/migration-manifest.js';
import { schemaMigrationsTableSql } from '../src/server/schema-migration-store.js';

export const schemaSnapshotPath = resolve(process.cwd(), 'src/server/schema-snapshot.sql');

function escapeSqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function renderSchemaMigrationRecord(migration) {
  return `
INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  ${escapeSqlLiteral(migration.migrationKey)},
  ${escapeSqlLiteral(migration.filename)},
  ${escapeSqlLiteral(migration.description)},
  ${escapeSqlLiteral(migration.checksum)},
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();
`.trim();
}

function renderMigrationSection(migration) {
  return [
    `-- Migration: ${migration.filename}`,
    `-- Checksum: ${migration.checksum}`,
    migration.sql.trimEnd(),
    '',
    renderSchemaMigrationRecord(migration),
  ].join('\n');
}

export function renderSchemaSnapshot({ migrations }) {
  if (!Array.isArray(migrations)) {
    throw new Error('migrations must be an array');
  }

  return [
    '-- Harmoniarr - Soulseek-native music library management',
    '-- Copyright (C) 2026 Harmoniarr Contributors',
    '--',
    '-- This program is free software: you can redistribute it and/or modify',
    '-- it under the terms of the GNU General Public License as published by',
    '-- the Free Software Foundation, either version 3 of the License, or',
    '-- (at your option) any later version.',
    '--',
    '-- This program is distributed in the hope that it will be useful,',
    '-- but WITHOUT ANY WARRANTY; without even the implied warranty of',
    '-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the',
    '-- GNU General Public License for more details.',
    '--',
    '-- You should have received a copy of the GNU General Public License',
    '-- along with this program. If not, see <https://www.gnu.org/licenses/>.',
    '',
    '-- Harmoniarr schema snapshot',
    '-- Generated from the accepted timestamped migration lineage.',
    '-- Refresh with: npm run update:schema-snapshot',
    '',
    'CREATE EXTENSION IF NOT EXISTS pgcrypto;',
    '',
    schemaMigrationsTableSql,
    '',
    ...migrations.map(renderMigrationSection),
  ].join('\n\n').trimEnd() + '\n';
}

export function assertSchemaSnapshotCurrent({ actualContent, expectedContent }) {
  if (!actualContent) {
    throw new Error(`Schema snapshot missing at ${schemaSnapshotPath}. Run npm run update:schema-snapshot.`);
  }

  if (actualContent !== expectedContent) {
    throw new Error(`Schema snapshot is stale at ${schemaSnapshotPath}. Run npm run update:schema-snapshot.`);
  }
}

export async function buildExpectedSchemaSnapshot() {
  const migrations = await loadMigrationManifest();

  return {
    content: renderSchemaSnapshot({ migrations }),
    migrationCount: migrations.length,
    snapshotPath: schemaSnapshotPath,
  };
}

export async function checkSchemaSnapshot() {
  const expected = await buildExpectedSchemaSnapshot();
  let actualContent = null;

  try {
    actualContent = await readFile(schemaSnapshotPath, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  assertSchemaSnapshotCurrent({
    actualContent,
    expectedContent: expected.content,
  });

  return expected;
}

export async function updateSchemaSnapshot() {
  const expected = await buildExpectedSchemaSnapshot();
  await writeFile(schemaSnapshotPath, expected.content, 'utf8');
  return expected;
}