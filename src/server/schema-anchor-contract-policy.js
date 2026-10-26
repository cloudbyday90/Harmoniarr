/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createHash } from 'node:crypto';
import { criticalSchemaAnchors } from './schema-anchor-service.js';

export const schemaAnchorSpecifications = Object.freeze(Object.fromEntries(
  ['tables', 'columns', 'constraints', 'indexes', 'triggers'].map(group => [group,
    Object.freeze(criticalSchemaAnchors[group].map(anchor => {
      const singular = { tables: 'table', columns: 'column', constraints: 'constraint', indexes: 'index', triggers: 'trigger' }[group];
      return Object.freeze({ key: [singular, ...(group === 'tables' ? [] : [anchor.table]), anchor[singular]].filter(Boolean).join('.'),
        name: anchor[singular] ?? anchor.table, ...(group !== 'tables' && anchor.table ? { parent: anchor.table } : {}) });
    })),
  ]),
));

export function canonicalAnchorJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalAnchorJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalAnchorJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function renderSchemaAnchorContract(contract) {
  return JSON.stringify(JSON.parse(canonicalAnchorJson(contract)), null, 2) + '\n';
}
const digest = value => createHash('sha256').update(value).digest('hex');
export function schemaAnchorProvenance({ snapshotSql, repoMigrations }) {
  return { format: 1, postgresMajor: 18, snapshotSha256: digest(snapshotSql),
    lineageSha256: digest(canonicalAnchorJson(repoMigrations.map(({ filename, migrationKey, checksum }) => ({ filename, migrationKey, checksum })))),
    specificationsSha256: digest(canonicalAnchorJson(schemaAnchorSpecifications)) };
}

const fields = {
  tables: ['kind', 'persistence', 'rowSecurity', 'forceRowSecurity'],
  columns: ['type', 'notNull', 'default', 'identity', 'generated', 'collation'],
  constraints: ['type', 'definition', 'validated', 'enforced', 'deferrable', 'deferred', 'noInherit'],
  indexes: ['definition', 'valid', 'ready', 'live', 'unique', 'nullsNotDistinct'],
  triggers: ['enabled', 'definition', 'functionDefinition'],
};
function safeRecord(group, record) {
  if (!record || canonicalAnchorJson(Object.keys(record).sort()) !== canonicalAnchorJson([...fields[group]].sort())) return false;
  const text = value => typeof value === 'string' && value.length > 0;
  const bools = keys => keys.every(key => typeof record[key] === 'boolean');
  if (group === 'tables') return ['r', 'p'].includes(record.kind) && record.persistence === 'p' && bools(['rowSecurity', 'forceRowSecurity']);
  if (group === 'columns') return text(record.type) && bools(['notNull']) && ['', 'a', 'd'].includes(record.identity)
    && ['', 's', 'v'].includes(record.generated) && (record.default === null || typeof record.default === 'string')
    && (record.collation === null || text(record.collation));
  if (group === 'constraints') return record.validated === true && record.enforced === true && text(record.definition)
    && ['c', 'f', 'n', 'p', 'u', 't', 'x'].includes(record.type) && bools(['deferrable', 'deferred', 'noInherit']);
  if (group === 'indexes') return record.valid === true && record.ready === true && record.live === true && text(record.definition) && bools(['unique', 'nullsNotDistinct']);
  return record.enabled === 'O' && text(record.definition) && text(record.functionDefinition);
}

export function assertSchemaAnchorContract(contract, provenance) {
  const invalid = () => { throw Object.assign(new Error('Schema anchor contract is missing, stale or invalid. Regenerate and review it from the migration-only schema source.'), { code: 'snapshot_anchor_contract_invalid' }); };
  if (!contract || canonicalAnchorJson(contract.provenance) !== canonicalAnchorJson(provenance)) invalid();
  if (canonicalAnchorJson(Object.keys(contract.anchors ?? {}).sort()) !== canonicalAnchorJson(Object.keys(schemaAnchorSpecifications).sort())) invalid();
  for (const [group, entries] of Object.entries(schemaAnchorSpecifications)) {
    const facts = contract.anchors[group];
    if (!facts || canonicalAnchorJson(Object.keys(facts).sort()) !== canonicalAnchorJson(entries.map(entry => entry.key).sort())) invalid();
    if (entries.some(entry => !safeRecord(group, facts[entry.key]))) invalid();
  }
  return contract;
}
