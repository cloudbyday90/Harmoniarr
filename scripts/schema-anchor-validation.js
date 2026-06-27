/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { applyPendingMigrations } from '../src/server/migrations.js';
import {
  assertSchemaAnchorComparisonClean,
  compareSchemaAnchorSnapshots,
  inspectSchemaAnchors,
} from '../src/server/schema-anchor-service.js';
import {
  bootstrapDatabaseSchemaFromSnapshot,
  defaultSchemaSnapshotPath,
} from '../src/server/schema-bootstrap.js';
import { withDockerizedPostgresDatabase } from '../testing/postgres-docker-database.js';
import { withTemporaryPostgresDatabase } from '../testing/postgres-temporary-database.js';

async function inspectSourceAnchors({ getPoolFn, inspectSchemaAnchorsFn }) {
  const pool = getPoolFn();
  const client = await pool.connect();

  try {
    return await inspectSchemaAnchorsFn({ client });
  } finally {
    client.release();
  }
}

export async function validateSchemaAnchorsAgainstSnapshot({
  applyPendingMigrationsFn = applyPendingMigrations,
  bootstrapSchemaFn = bootstrapDatabaseSchemaFromSnapshot,
  getPoolFn = null,
  inspectSchemaAnchorsFn = inspectSchemaAnchors,
  schemaSnapshotPath = defaultSchemaSnapshotPath,
  withDockerizedPostgresDatabaseFn = withDockerizedPostgresDatabase,
  withTemporaryPostgresDatabaseFn = null,
} = {}) {
  const compareSourceToSnapshot = async ({
    sourcePoolFn,
    snapshotDatabaseRunner,
  }) => {
    const source = await inspectSourceAnchors({
      getPoolFn: sourcePoolFn,
      inspectSchemaAnchorsFn,
    });

    return snapshotDatabaseRunner({
      run: async ({ databaseName, getPoolFn: getSnapshotPoolFn }) => {
        const bootstrapResult = await bootstrapSchemaFn({
          getPoolFn: getSnapshotPoolFn,
          schemaSnapshotPath,
        });

        if (!bootstrapResult.bootstrapped) {
          throw new Error(`Schema snapshot bootstrap did not run for anchor validation database ${databaseName}`);
        }

        const snapshotPool = getSnapshotPoolFn();
        const snapshotClient = await snapshotPool.connect();

        try {
          const snapshot = await inspectSchemaAnchorsFn({ client: snapshotClient });
          const comparison = compareSchemaAnchorSnapshots({ snapshot, source });
          assertSchemaAnchorComparisonClean(comparison);

          return {
            anchorCount: comparison.anchorCount,
            databaseName,
            schemaSnapshotPath,
          };
        } finally {
          snapshotClient.release();
        }
      },
    });
  };

  if (typeof getPoolFn === 'function') {
    return compareSourceToSnapshot({
      sourcePoolFn: getPoolFn,
      snapshotDatabaseRunner: withTemporaryPostgresDatabaseFn ?? withDockerizedPostgresDatabaseFn,
    });
  }

  return withDockerizedPostgresDatabaseFn({
    run: async ({ env, getPoolFn: sourcePoolFn }) => {
      await applyPendingMigrationsFn({ getPoolFn: sourcePoolFn });
      const temporaryDatabaseRunner = withTemporaryPostgresDatabaseFn ?? withTemporaryPostgresDatabase;
      return compareSourceToSnapshot({
        sourcePoolFn,
        snapshotDatabaseRunner: (options = {}) => temporaryDatabaseRunner({
          ...options,
          env,
        }),
      });
    },
  });
}
