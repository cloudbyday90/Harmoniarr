/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../src/server/database.js';
import {
  assertSchemaAnchorComparisonClean,
  compareSchemaAnchorSnapshots,
  inspectSchemaAnchors,
} from '../src/server/schema-anchor-service.js';
import {
  bootstrapDatabaseSchemaFromSnapshot,
  defaultSchemaSnapshotPath,
} from '../src/server/schema-bootstrap.js';
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
  bootstrapSchemaFn = bootstrapDatabaseSchemaFromSnapshot,
  getPoolFn = getPool,
  inspectSchemaAnchorsFn = inspectSchemaAnchors,
  schemaSnapshotPath = defaultSchemaSnapshotPath,
  withTemporaryPostgresDatabaseFn = withTemporaryPostgresDatabase,
} = {}) {
  const source = await inspectSourceAnchors({ getPoolFn, inspectSchemaAnchorsFn });

  return withTemporaryPostgresDatabaseFn({
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
}
