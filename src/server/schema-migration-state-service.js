/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { getPool } from './database.js';
import { loadMigrationManifest } from './migration-manifest.js';
import { ensureSchemaTable } from './schema-migration-store.js';

const appliedStatus = 'applied';

function byFilename(left, right) {
  return String(left.filename).localeCompare(String(right.filename));
}

function normalizeDatabaseMigrationRow(row) {
  return {
    checksum: row.checksum ?? null,
    errorMessage: row.error_message ?? null,
    filename: row.filename,
    migrationKey: row.migration_key ?? null,
    status: row.status ?? null,
  };
}

function buildRepoMigrationIndex(repoMigrations) {
  return new Map(repoMigrations.map((migration) => [migration.filename, migration]));
}

export function buildDatabaseMigrationStateReport({
  databaseRows = [],
  repoMigrations = [],
} = {}) {
  const repoMigrationIndex = buildRepoMigrationIndex(repoMigrations);
  const normalizedRows = databaseRows.map(normalizeDatabaseMigrationRow).sort(byFilename);
  const appliedRows = normalizedRows.filter((row) => row.status === appliedStatus);
  const appliedIndex = new Map(appliedRows.map((row) => [row.filename, row]));
  const nonAppliedRows = normalizedRows.filter((row) => row.status !== appliedStatus);

  const pending = repoMigrations
    .filter((migration) => !appliedIndex.has(migration.filename))
    .map((migration) => migration.filename);

  const unknownApplied = appliedRows
    .filter((row) => !repoMigrationIndex.has(row.filename))
    .map((row) => row.filename);

  const checksumDrift = appliedRows
    .map((row) => {
      const repoMigration = repoMigrationIndex.get(row.filename);
      if (!repoMigration || row.checksum === repoMigration.checksum) {
        return null;
      }

      return {
        currentChecksum: repoMigration.checksum,
        filename: row.filename,
        storedChecksum: row.checksum,
      };
    })
    .filter(Boolean);

  return {
    appliedCount: appliedRows.length,
    appliedRows,
    checksumDrift,
    current: pending.length === 0
      && unknownApplied.length === 0
      && checksumDrift.length === 0
      && nonAppliedRows.length === 0,
    nonAppliedRows,
    pending,
    repoCount: repoMigrations.length,
    unknownApplied,
  };
}

export function formatDatabaseMigrationStateSummary(report) {
  return [
    `${report.repoCount} repo migration(s)`,
    `${report.appliedCount} applied`,
    `${report.pending.length} pending`,
    `${report.unknownApplied.length} unknown applied`,
    `${report.checksumDrift.length} checksum drift`,
    `${report.nonAppliedRows.length} non-applied row(s)`,
  ].join(', ');
}

export function formatDatabaseMigrationStateDiagnostics(report) {
  const lines = [
    `Migration state: ${report.current ? 'current' : 'not current'}`,
    formatDatabaseMigrationStateSummary(report),
  ];

  if (report.pending.length > 0) {
    lines.push(`Pending repo migrations: ${report.pending.join(', ')}`);
  }

  if (report.unknownApplied.length > 0) {
    lines.push(`Applied migrations missing from repo: ${report.unknownApplied.join(', ')}`);
  }

  if (report.checksumDrift.length > 0) {
    lines.push(`Checksum drift: ${report.checksumDrift
      .map((entry) => `${entry.filename} (${entry.storedChecksum} != ${entry.currentChecksum})`)
      .join(', ')}`);
  }

  if (report.nonAppliedRows.length > 0) {
    lines.push(`Non-applied migration rows: ${report.nonAppliedRows
      .map((row) => `${row.filename} (${row.status}${row.errorMessage ? `: ${row.errorMessage}` : ''})`)
      .join(', ')}`);
  }

  return lines.join('\n');
}

export async function inspectDatabaseMigrationState({
  getPoolFn = getPool,
  loadMigrationManifestFn = loadMigrationManifest,
} = {}) {
  const repoMigrations = await loadMigrationManifestFn();
  const pool = getPoolFn();
  const client = await pool.connect();

  try {
    await ensureSchemaTable(client);
    const result = await client.query(`
      SELECT filename, checksum, status, migration_key, error_message
      FROM schema_migrations
      ORDER BY filename ASC
    `);

    return buildDatabaseMigrationStateReport({
      databaseRows: result.rows,
      repoMigrations,
    });
  } finally {
    client.release();
  }
}

export async function assertDatabaseMigrationStateCurrent(options = {}) {
  const report = await inspectDatabaseMigrationState(options);
  if (!report.current) {
    throw new Error([
      'Database migration state is not current.',
      formatDatabaseMigrationStateDiagnostics(report),
      'Run npm run migrate, resolve failed migration rows, or refresh the source database before updating the schema snapshot.',
    ].join('\n'));
  }

  return report;
}
