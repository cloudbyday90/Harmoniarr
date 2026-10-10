/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

export const libraryTestSchemaEnvironmentKeys = Object.freeze({
  catalogue: 'HARMONIARR_INTEGRATION_CATALOGUE_SCHEMA_MODE',
  release_reconciliation: 'HARMONIARR_INTEGRATION_RELEASE_SCHEMA_MODE',
  tag_snapshot: 'HARMONIARR_INTEGRATION_TAG_SCHEMA_MODE',
});
const modes = new Set(['empty', 'migration_template']);

/** A suite selects its own default; the global PostgreSQL runtime remains unchanged. */
export function resolveLibraryTestSchemaMode({ domain, env = process.env, defaultMode = 'empty' } = {}) {
  if (!Object.hasOwn(libraryTestSchemaEnvironmentKeys, domain) || !env || typeof env !== 'object'
    || Array.isArray(env) || !modes.has(defaultMode)) throw new TypeError('Invalid library test schema policy');
  const configured = env[libraryTestSchemaEnvironmentKeys[domain]];
  const mode = configured === undefined ? defaultMode : configured;
  if (!modes.has(mode)) throw new TypeError('Library test schema mode must be empty or migration_template');
  return mode;
}
