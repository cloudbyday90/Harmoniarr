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

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const migrationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), 'migrations');
export const migrationFilenamePattern = /^(?<migrationKey>\d{8}_\d{6})_(?<description>[a-z0-9_]+)\.sql$/;

export function parseMigrationFilename(name) {
  const match = migrationFilenamePattern.exec(name);
  if (!match?.groups) {
    throw new Error(`Invalid migration filename: ${name}`);
  }

  return {
    filename: name,
    migrationKey: match.groups.migrationKey,
    description: match.groups.description,
  };
}

export function checksumSql(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

export async function listMigrationFiles() {
  const entries = await readdir(migrationDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extname(entry.name) === '.sql')
    .map((entry) => parseMigrationFilename(entry.name))
    .sort((left, right) => left.filename.localeCompare(right.filename));
}

export async function readMigrationFile(migrationReference) {
  const migration = typeof migrationReference === 'string'
    ? parseMigrationFilename(migrationReference)
    : migrationReference;
  const path = resolve(migrationDirectory, migration.filename);
  const sql = await readFile(path, 'utf8');

  return {
    ...migration,
    checksum: checksumSql(sql),
    path,
    sql,
  };
}

export async function loadMigrationManifest() {
  const files = await listMigrationFiles();
  return Promise.all(files.map((migration) => readMigrationFile(migration)));
}