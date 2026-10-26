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
import { renderSchemaSnapshot } from '../src/server/schema-snapshot-renderer.js';
export { renderSchemaSnapshot };
import { withDockerizedPostgresDatabase } from '../testing/postgres-docker-database.js';
import { withTemporaryPostgresDatabase } from '../testing/postgres-temporary-database.js';
import { validateSchemaAnchorsAgainstSnapshot } from './schema-anchor-validation.js';
import { validateSchemaBootstrap } from './schema-bootstrap-validation.js';

export const schemaSnapshotPath = resolve(process.cwd(), 'src/server/schema-snapshot.sql');

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
