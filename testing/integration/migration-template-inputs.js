/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { checksumSql, loadMigrationManifest, parseMigrationFilename } from '../../src/server/migration-manifest.js';

export const MIGRATION_TEMPLATE_INPUT_VERSION = 1;
export const MIGRATION_TEMPLATE_MODE = 'migration-only';

const manifestKeys = ['filename', 'migrationKey', 'description', 'checksum'];
const profileKeys = ['serverVersion', 'encoding', 'localeProvider', 'collation', 'ctype', 'locale', 'icuRules'];
const sourceFiles = [
  ['testing/integration/migration-template-preparation.js', new URL('./migration-template-preparation.js', import.meta.url)],
  ['src/server/migrations.js', new URL('../../src/server/migrations.js', import.meta.url)],
  ['src/server/migration-manifest.js', new URL('../../src/server/migration-manifest.js', import.meta.url)],
  ['src/server/schema-migration-store.js', new URL('../../src/server/schema-migration-store.js', import.meta.url)],
  ['src/server/schema-id-function.js', new URL('../../src/server/schema-id-function.js', import.meta.url)],
  ['src/server/schema-migration-state-service.js', new URL('../../src/server/schema-migration-state-service.js', import.meta.url)],
];
const digest = (value) => createHash('sha256').update(value).digest('hex');
const isHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const invalidInputs = () => new TypeError('Migration template inputs are invalid');

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function hasKeys(value, required, optional = []) {
  return isRecord(value) && required.every((key) => Object.hasOwn(value, key))
    && Reflect.ownKeys(value).every((key) => [...required, ...optional].includes(key));
}

/** Copy the captured lineage before an asynchronous preparation can observe caller mutation. */
export function captureMigrationTemplateInputs(inputs) {
  if (!hasKeys(inputs, ['manifest', 'sourceFingerprint']) || !isHash(inputs.sourceFingerprint)
    || !Array.isArray(inputs.manifest) || inputs.manifest.length === 0) throw invalidInputs();
  const manifest = [];
  const migrationKeys = new Set();
  let previousFilename = null;
  for (const migration of inputs.manifest) {
    if (!hasKeys(migration, manifestKeys, ['path', 'sql']) || !isHash(migration.checksum)) throw invalidInputs();
    let identity;
    try { identity = parseMigrationFilename(migration.filename); }
    catch { throw invalidInputs(); }
    if (identity.migrationKey !== migration.migrationKey || identity.description !== migration.description
      || migrationKeys.has(migration.migrationKey)
      || (previousFilename !== null && previousFilename.localeCompare(migration.filename) >= 0)
      || (Object.hasOwn(migration, 'path') && (typeof migration.path !== 'string' || !migration.path))
      || (Object.hasOwn(migration, 'sql') && (typeof migration.sql !== 'string' || checksumSql(migration.sql) !== migration.checksum))) {
      throw invalidInputs();
    }
    previousFilename = migration.filename;
    migrationKeys.add(migration.migrationKey);
    const captured = Object.fromEntries(manifestKeys.map((key) => [key, migration[key]]));
    if (Object.hasOwn(migration, 'path')) captured.path = migration.path;
    if (Object.hasOwn(migration, 'sql')) captured.sql = migration.sql;
    manifest.push(Object.freeze(captured));
  }
  return Object.freeze({ manifest: Object.freeze(manifest), sourceFingerprint: inputs.sourceFingerprint });
}

export async function loadMigrationTemplateInputs() {
  if (arguments.length !== 0) throw invalidInputs();
  const [manifest, sources] = await Promise.all([
    loadMigrationManifest(),
    Promise.all(sourceFiles.map(async ([file, url]) => ({ file, checksum: digest(await readFile(url)) }))),
  ]);
  const sourceFingerprint = digest(JSON.stringify({ version: MIGRATION_TEMPLATE_INPUT_VERSION,
    mode: MIGRATION_TEMPLATE_MODE, sources }));
  return captureMigrationTemplateInputs({ manifest, sourceFingerprint });
}

export function buildMigrationTemplateFingerprint(options = {}) {
  if (!hasKeys(options, ['inputs', 'databaseProfile'])) throw invalidInputs();
  const { inputs, databaseProfile } = options;
  const captured = captureMigrationTemplateInputs(inputs);
  if (!hasKeys(databaseProfile, profileKeys)
    || !['serverVersion', 'encoding'].every((key) => typeof databaseProfile[key] === 'string' && databaseProfile[key].trim())
    || !profileKeys.slice(2).every((key) => databaseProfile[key] === null || typeof databaseProfile[key] === 'string')) {
    throw new TypeError('Migration template database profile is invalid');
  }
  return digest(JSON.stringify({ version: MIGRATION_TEMPLATE_INPUT_VERSION, mode: MIGRATION_TEMPLATE_MODE,
    sourceFingerprint: captured.sourceFingerprint,
    manifest: captured.manifest.map((migration) => Object.fromEntries(manifestKeys.map((key) => [key, migration[key]]))),
    databaseProfile: Object.fromEntries(profileKeys.map((key) => [key, databaseProfile[key]])),
  }));
}
