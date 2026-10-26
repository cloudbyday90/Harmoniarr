/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { prepareDockerSchemaSource, buildExpectedSchemaSnapshot } from './schema-snapshot.js';
import { withDatabasePreparation } from '../src/server/database-preparation-owner-service.js';
import { executeOwnedSqlTransaction } from '../src/server/owned-sql-transaction-service.js';
import { inspectSchemaAnchorCatalog } from '../src/server/schema-anchor-catalog-service.js';
import { assertSchemaAnchorContract, schemaAnchorProvenance, renderSchemaAnchorContract } from '../src/server/schema-anchor-contract-policy.js';
import { loadSchemaAnchorContract, defaultSchemaAnchorContractPath } from '../src/server/schema-anchor-contract-service.js';
import { loadMigrationManifest } from '../src/server/migration-manifest.js';

async function sourceProvenance() {
  const [{ content: snapshotSql }, repoMigrations] = await Promise.all([buildExpectedSchemaSnapshot(), loadMigrationManifest()]);
  const actual = await readFile(new URL('../src/server/schema-snapshot.sql', import.meta.url), 'utf8');
  if (actual !== snapshotSql) throw new Error('Update and review the schema snapshot before its anchor contract.');
  return { snapshotSql, repoMigrations };
}

export async function checkSchemaAnchorContract() {
  const contract = await loadSchemaAnchorContract(await sourceProvenance());
  return { anchorCount: Object.values(contract.anchors).reduce((count, group) => count + Object.keys(group).length, 0) };
}

export async function updateSchemaAnchorContract({ prepareSchemaSourceFn = prepareDockerSchemaSource, writeFileFn = writeFile } = {}) {
  const provenance = schemaAnchorProvenance(await sourceProvenance());
  const anchors = await prepareSchemaSourceFn({ run: source => withDatabasePreparation({ getPoolFn: source.getPoolFn },
    ({ client, markClientUnusable }) => executeOwnedSqlTransaction({ client, markClientUnusable,
      work: () => inspectSchemaAnchorCatalog(client),
      unknownCommitErrorFn: cause => new Error('Anchor source transaction completion was not acknowledged.', { cause }),
      commitRolledBackErrorFn: () => new Error('Anchor source transaction rolled back.'),
    })) });
  const contract = assertSchemaAnchorContract({ provenance, anchors }, provenance);
  // No timestamps or database names: a fresh migration source must reproduce this artifact.
  await writeFileFn(defaultSchemaAnchorContractPath, renderSchemaAnchorContract(contract), 'utf8');
  return { anchorCount: Object.values(anchors).reduce((count, group) => count + Object.keys(group).length, 0) };
}
