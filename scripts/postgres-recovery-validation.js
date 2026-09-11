/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { bootstrapDatabaseSchemaFromSnapshot } from '../src/server/schema-bootstrap.js';
import { loadMigrationManifest } from '../src/server/migration-manifest.js';
import { getAppliedMigrationChecksums } from '../src/server/schema-migration-store.js';
import { inspectSchemaAnchors, compareSchemaAnchorSnapshots, assertSchemaAnchorComparisonClean } from '../src/server/schema-anchor-service.js';
import { seedRequestRecoveryFixture } from '../testing/recovery/request-recovery-fixture.js';
import { captureRequestRecoverySnapshot, verifyRestoredRequestRecovery } from '../testing/recovery/request-recovery-verification.js';
import { seedOperationalRecoveryFixture, verifyRestoredOperationalRecovery } from '../testing/recovery/operational-recovery-fixture.js';
import { withPostgresRecoveryRuntime } from './postgres-recovery-runtime.js';
import { buildPostgresRecoveryEvidence } from './postgres-recovery-evidence.js';

export async function validatePostgresRecovery({ withRuntime = withPostgresRecoveryRuntime } = {}) {
  let phase = 'runtime';
  try {
    const result = await withRuntime({ run: async ({ sourcePool, dumpAndRestore, imageId, postgresVersion }) => {
      phase = 'schema';
      const bootstrap = await bootstrapDatabaseSchemaFromSnapshot({ getPoolFn: () => sourcePool });
      assert.equal(bootstrap.bootstrapped, true);
      const migrations = await loadMigrationManifest();
      const expectedMigrations = migrations.map(({ filename, checksum }) => ({ filename, storedChecksum: checksum }));
      assert.deepEqual(await getAppliedMigrationChecksums(sourcePool), expectedMigrations);
      const sourceAnchors = await inspectSchemaAnchors({ client: sourcePool });
      phase = 'fixture';
      const requestFixture = await seedRequestRecoveryFixture({ getPoolFn: () => sourcePool });
      const operationalFixture = await seedOperationalRecoveryFixture({ getPoolFn: () => sourcePool });
      const expectedSnapshot = await captureRequestRecoverySnapshot({ queryable: sourcePool, fixture: requestFixture });
      phase = 'archive';
      const { targetPool, archiveBytes, archiveSha256, failedRestoreRolledBack } = await dumpAndRestore();
      phase = 'restored_schema';
      assert.deepEqual(await getAppliedMigrationChecksums(targetPool), expectedMigrations);
      const targetAnchors = await inspectSchemaAnchors({ client: targetPool });
      const comparison = assertSchemaAnchorComparisonClean(compareSchemaAnchorSnapshots({ source: sourceAnchors, snapshot: targetAnchors }));
      phase = 'request_continuity';
      const requests = await verifyRestoredRequestRecovery({ getPoolFn: () => targetPool, fixture: requestFixture, expectedSnapshot });
      phase = 'operational_continuity';
      const operations = await verifyRestoredOperationalRecovery({ getPoolFn: () => targetPool, fixture: operationalFixture });
      phase = 'cleanup';
      return { imageId, postgresVersion, archiveBytes, archiveSha256, failedRestoreRolledBack,
        migrationCount: migrations.length, anchorCount: comparison.anchorCount, schemaPreserved: true, requests, operations };
    } });
    phase = 'evidence';
    return buildPostgresRecoveryEvidence(result);
  } catch {
    throw Object.assign(new Error(`PostgreSQL recovery rehearsal failed during ${phase}; no successful evidence was produced`), {
      code: 'postgres_recovery_rehearsal_failed', phase,
    });
  }
}
