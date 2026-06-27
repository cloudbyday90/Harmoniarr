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
import { listMigrationFiles, readMigrationFile } from './migration-manifest.js';
import { ensureSchemaTable, getAppliedMigrationChecksums, getAppliedMigrationFilenames } from './schema-migration-store.js';

export async function getMigrationStatus({ getPoolFn = getPool } = {}) {
  const pool = getPoolFn();
  const client = await pool.connect();

  try {
    await ensureSchemaTable(client);
    const files = await listMigrationFiles();
    const applied = await getAppliedMigrationFilenames(client);
    const pending = files.filter((file) => !applied.has(file.filename)).map((file) => file.filename);

    return {
      available: files.length,
      applied: applied.size,
      pending,
    };
  } finally {
    client.release();
  }
}

export async function applyPendingMigrations({ getPoolFn = getPool } = {}) {
  const pool = getPoolFn();
  const client = await pool.connect();

  try {
    await ensureSchemaTable(client);

    const files = await listMigrationFiles();
    const applied = await getAppliedMigrationFilenames(client);
    const pending = files.filter((file) => !applied.has(file.filename));

    for (const migration of pending) {
      const migrationFile = await readMigrationFile(migration);
      const { checksum, sql } = migrationFile;
      const startedAt = new Date();

      try {
        await client.query('BEGIN');
        await client.query(
          `
            INSERT INTO schema_migrations (
              migration_key,
              filename,
              description,
              checksum,
              status,
              started_at,
              application_version,
              updated_at
            )
            VALUES ($1, $2, $3, $4, 'running', $5, $6, NOW())
            ON CONFLICT (filename) DO UPDATE
            SET migration_key = EXCLUDED.migration_key,
                description = EXCLUDED.description,
                checksum = EXCLUDED.checksum,
                status = 'running',
                started_at = EXCLUDED.started_at,
                finished_at = NULL,
                duration_ms = NULL,
                error_message = NULL,
                application_version = EXCLUDED.application_version,
                updated_at = NOW()
          `,
          [
            migration.migrationKey,
            migration.filename,
            migration.description,
            checksum,
            startedAt,
            process.env.HARMONIARR_VERSION ?? process.env.npm_package_version ?? null,
          ],
        );

        await client.query(sql);

        await client.query(
          `
            UPDATE schema_migrations
            SET status = 'applied',
                finished_at = NOW(),
                duration_ms = $2,
                error_message = NULL,
                updated_at = NOW()
            WHERE filename = $1
          `,
          [migration.filename, Date.now() - startedAt.getTime()],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        await client.query(
          `
            INSERT INTO schema_migrations (
              migration_key,
              filename,
              description,
              checksum,
              status,
              started_at,
              finished_at,
              duration_ms,
              error_message,
              application_version,
              updated_at
            )
            VALUES ($1, $2, $3, $4, 'failed', $5, NOW(), $6, $7, $8, NOW())
            ON CONFLICT (filename) DO UPDATE
            SET status = 'failed',
                finished_at = NOW(),
                duration_ms = $6,
                error_message = $7,
                checksum = EXCLUDED.checksum,
                application_version = $8,
                updated_at = NOW()
          `,
          [
            migration.migrationKey,
            migration.filename,
            migration.description,
            checksum,
            startedAt,
            Date.now() - startedAt.getTime(),
            error instanceof Error ? error.message : String(error),
            process.env.HARMONIARR_VERSION ?? process.env.npm_package_version ?? null,
          ],
        );
        throw error;
      }
    }

    return pending.map((migration) => migration.filename);
  } finally {
    client.release();
  }
}

export async function assertNoPendingMigrations(options = {}) {
  const status = await getMigrationStatus(options);
  if (status.pending.length > 0) {
    throw new Error(`Pending migrations detected: ${status.pending.join(', ')}`);
  }

  return status;
}

export async function verifyAppliedMigrationChecksums({ getPoolFn = getPool } = {}) {
  const pool = getPoolFn();
  const client = await pool.connect();

  try {
    await ensureSchemaTable(client);
    const applied = await getAppliedMigrationChecksums(client);

    const violations = [];
    for (const { filename, storedChecksum } of applied) {
      let currentChecksum;
      try {
        const migrationFile = await readMigrationFile(filename);
        currentChecksum = migrationFile.checksum;
      } catch {
        violations.push({ currentChecksum: null, filename, status: 'file_missing', storedChecksum });
        continue;
      }

      if (currentChecksum !== storedChecksum) {
        violations.push({ currentChecksum, filename, status: 'checksum_mismatch', storedChecksum });
      }
    }

    return {
      checkedCount: applied.length,
      clean: violations.length === 0,
      violations,
    };
  } finally {
    client.release();
  }
}

export async function assertNoMigrationChecksumDrift({ getPoolFn = getPool } = {}) {
  const result = await verifyAppliedMigrationChecksums({ getPoolFn });
  if (!result.clean) {
    const descriptions = result.violations.map(({ filename, status }) => `${filename} (${status})`).join(', ');
    throw new Error(`Migration checksum drift detected: ${descriptions}`);
  }

  return result;
}
