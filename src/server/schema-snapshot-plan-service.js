/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { renderSchemaSnapshot } from './schema-snapshot-renderer.js';
import { prepareMigrationTransactionSql } from './migration-sql-transaction-policy.js';

/** Validate immutable source provenance before compiling recognized frames in memory. */
export function prepareSchemaSnapshotSql({ snapshotSql, repoMigrations }) {
  if (!Array.isArray(repoMigrations) || !repoMigrations.length || snapshotSql !== renderSchemaSnapshot({ migrations: repoMigrations })) {
    throw Object.assign(new Error('Schema snapshot does not match the captured migration lineage. Use a matching verified application image; do not rewrite history.'),
      { code: 'snapshot_provenance_invalid' });
  }
  const compiled = repoMigrations.map(migration => ({ ...migration, sql: prepareMigrationTransactionSql(migration.sql) }));
  return prepareMigrationTransactionSql(renderSchemaSnapshot({ migrations: compiled }));
}
