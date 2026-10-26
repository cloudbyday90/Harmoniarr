/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { readFile } from 'node:fs/promises';
import { loadMigrationManifest } from './migration-manifest.js';
import { loadSchemaAnchorContract } from './schema-anchor-contract-service.js';
import { compareSchemaAnchorCatalog } from './schema-anchor-contract-policy.js';
import { inspectSchemaAnchorCatalog } from './schema-anchor-catalog-service.js';
import { withSchemaObservation } from './schema-observation-owner-service.js';
import { readObservedMigrationRows } from './schema-observation-store.js';
import { summarizeObservedLineage } from './schema-drift-report-policy.js';

export async function inspectDatabaseSchemaDrift({ getPoolFn, loadMigrationManifestFn = loadMigrationManifest,
  readSnapshotFn = () => readFile(new URL('./schema-snapshot.sql', import.meta.url), 'utf8'),
  loadSchemaAnchorContractFn = loadSchemaAnchorContract } = {}) {
  try {
    const repoMigrations = await loadMigrationManifestFn();
    const contract = await loadSchemaAnchorContractFn({ repoMigrations, snapshotSql: await readSnapshotFn() });
    return await withSchemaObservation({ getPoolFn }, async client => {
      const lineage = summarizeObservedLineage({ observation: await readObservedMigrationRows(client, repoMigrations.length + 1), repoMigrations });
      const anchors = compareSchemaAnchorCatalog({ actual: await inspectSchemaAnchorCatalog(client), contract });
      return { current: lineage.state === 'current' && anchors.state === 'current', lineage, anchors };
    });
  } catch (cause) {
    if (cause?.code === 'schema_observation_busy') throw cause;
    throw Object.assign(new Error('Schema diagnostics unavailable. No schema or migration repair was attempted.', { cause }), { code: 'schema_diagnostics_unavailable' });
  }
}
