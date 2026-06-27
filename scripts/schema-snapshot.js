/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applyPendingMigrations } from '../src/server/migrations.js';
import { loadMigrationManifest } from '../src/server/migration-manifest.js';
import { assertDatabaseMigrationStateCurrent } from '../src/server/schema-migration-state-service.js';
import { schemaIdFunctionSql, schemaIdPgcryptoSql } from '../src/server/schema-id-function.js';
import { schemaMigrationsTableSql } from '../src/server/schema-migration-store.js';
import { withDockerizedPostgresDatabase } from '../testing/postgres-docker-database.js';
import { withTemporaryPostgresDatabase } from '../testing/postgres-temporary-database.js';
import { validateSchemaAnchorsAgainstSnapshot } from './schema-anchor-validation.js';
import { validateSchemaBootstrap } from './schema-bootstrap-validation.js';

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
    schemaIdPgcryptoSql,
    '',
    schemaIdFunctionSql,
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

function createTemporaryDatabaseRunner(env) {
  return (options = {}) => withTemporaryPostgresDatabase({
    ...options,
    env,
  });
}

export async function prepareDockerSchemaSource({
  applyPendingMigrationsFn = applyPendingMigrations,
  assertDatabaseMigrationStateCurrentFn = assertDatabaseMigrationStateCurrent,
  run = null,
  withDockerizedPostgresDatabaseFn = withDockerizedPostgresDatabase,
} = {}) {
  return withDockerizedPostgresDatabaseFn({
    run: async ({ databaseName, env, getPoolFn, image }) => {
      const appliedMigrations = await applyPendingMigrationsFn({ getPoolFn });
      const databaseState = await assertDatabaseMigrationStateCurrentFn({ getPoolFn });
      const source = {
        appliedMigrations,
        databaseName,
        databaseState,
        getPoolFn,
        image,
        temporaryDatabaseRunner: createTemporaryDatabaseRunner(env),
      };

      if (typeof run === 'function') {
        return run(source);
      }

      return {
        appliedMigrations: source.appliedMigrations,
        databaseName: source.databaseName,
        databaseState: source.databaseState,
        image: source.image,
      };
    },
  });
}

export async function updateSchemaSnapshot({
  prepareSchemaSourceFn = prepareDockerSchemaSource,
  writeFileFn = writeFile,
} = {}) {
  const source = await prepareSchemaSourceFn();
  const expected = await buildExpectedSchemaSnapshot();
  await writeFileFn(schemaSnapshotPath, expected.content, 'utf8');
  return {
    ...expected,
    appliedMigrations: source.appliedMigrations ?? [],
    databaseName: source.databaseName ?? null,
    databaseState: source.databaseState ?? null,
    dockerImage: source.image ?? null,
  };
}

export async function checkDatabaseBackedSchema({
  checkSchemaSnapshotFn = checkSchemaSnapshot,
  prepareSchemaSourceFn = prepareDockerSchemaSource,
  validateSchemaAnchorsAgainstSnapshotFn = validateSchemaAnchorsAgainstSnapshot,
  validateSchemaBootstrapFn = validateSchemaBootstrap,
} = {}) {
  return prepareSchemaSourceFn({
    run: async (source) => {
      const snapshot = await checkSchemaSnapshotFn();
      const temporaryDatabaseRunner = source.temporaryDatabaseRunner ?? withTemporaryPostgresDatabase;
      const bootstrap = await validateSchemaBootstrapFn({
        withDockerizedPostgresDatabaseFn: temporaryDatabaseRunner,
      });
      const anchors = await validateSchemaAnchorsAgainstSnapshotFn({
        getPoolFn: source.getPoolFn,
        withDockerizedPostgresDatabaseFn: temporaryDatabaseRunner,
      });

      return {
        anchors,
        bootstrap,
        databaseName: source.databaseName ?? null,
        databaseState: source.databaseState ?? null,
        dockerImage: source.image ?? null,
        snapshot,
      };
    },
  });
}
