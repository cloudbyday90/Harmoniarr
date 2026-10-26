/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { readFile } from 'node:fs/promises';
import { assertSchemaAnchorContract, canonicalAnchorJson, schemaAnchorProvenance, schemaAnchorSpecifications } from './schema-anchor-contract-policy.js';
import { inspectSchemaAnchorCatalog } from './schema-anchor-catalog-service.js';

export const defaultSchemaAnchorContractPath = new URL('./schema-anchor-contract.json', import.meta.url);

export async function loadSchemaAnchorContract({ snapshotSql, repoMigrations, readFileFn = readFile }) {
  let contract;
  try { contract = JSON.parse(await readFileFn(defaultSchemaAnchorContractPath, 'utf8')); }
  catch (cause) {
    throw Object.assign(new Error('Packaged schema anchor contract could not be read.', { cause }), { code: 'snapshot_anchor_contract_invalid' });
  }
  return assertSchemaAnchorContract(contract, schemaAnchorProvenance({ snapshotSql, repoMigrations }));
}

export async function assertSnapshotSchemaAnchors({ client, contract }) {
  const actual = await inspectSchemaAnchorCatalog(client);
  const mismatches = [];
  for (const [group, entries] of Object.entries(schemaAnchorSpecifications)) {
    for (const { key } of entries) {
      if (canonicalAnchorJson(actual[group]?.[key]) !== canonicalAnchorJson(contract.anchors[group][key])) mismatches.push(key);
    }
  }
  if (mismatches.length) {
    throw Object.assign(new Error(`Schema snapshot failed critical anchor verification before commit (${mismatches.length} mismatches).`),
      { code: 'snapshot_schema_anchors_invalid', anchors: mismatches });
  }
}
