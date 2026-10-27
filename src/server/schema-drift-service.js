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
import { readObservedMigrationRows, hasBlockingSchemaMaintenance } from './schema-observation-store.js';
import { summarizeObservedLineage } from './schema-drift-report-policy.js';
import { startSchemaDiagnosticTask } from './schema-diagnostic-task-service.js';

export function startDatabaseSchemaDriftInspection({ createConnectionFn, loadMigrationManifestFn = loadMigrationManifest,
  readSnapshotFn = () => readFile(new URL('./schema-snapshot.sql', import.meta.url), 'utf8'),
  loadSchemaAnchorContractFn = loadSchemaAnchorContract, respectMaintenance = false, ...options } = {}) {
  return startSchemaDiagnosticTask(async scope => {
    try {
      const repoMigrations = await loadMigrationManifestFn();
      scope.check();
      const snapshotSql = await readSnapshotFn();
      scope.check();
      const contract = await loadSchemaAnchorContractFn({ repoMigrations, snapshotSql });
      scope.check();
      return await withSchemaObservation({ createConnectionFn, scope }, async client => {
        if (respectMaintenance && await hasBlockingSchemaMaintenance(client)) {
          throw Object.assign(new Error('Schema checks paused for recovery maintenance'), { code: 'schema_maintenance_paused' });
        }
        const lineage = summarizeObservedLineage({ observation: await readObservedMigrationRows(client, repoMigrations.length + 1), repoMigrations });
        const anchors = compareSchemaAnchorCatalog({ actual: await inspectSchemaAnchorCatalog(client), contract });
        return { current: lineage.state === 'current' && anchors.state === 'current', lineage, anchors };
      });
    } catch (cause) {
      if (['schema_observation_busy', 'schema_maintenance_paused'].includes(cause?.code)) throw cause;
      throw Object.assign(new Error('Schema diagnostics unavailable. No schema or migration repair was attempted.', { cause }), { code: 'schema_diagnostics_unavailable' });
    }
  }, options);
}

export function inspectDatabaseSchemaDrift(options) {
  return startDatabaseSchemaDriftInspection(options).result;
}
