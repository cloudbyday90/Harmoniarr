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

import { readFile } from 'node:fs/promises';
import { getPool } from './database.js';
import { createDependencyHealthService } from './dependency-health-service.js';
import { getMigrationStatus } from './migrations.js';
import { createPathValidationSummary } from './paths/path-validation-summary.js';
import { createSettingsService } from './settings-service.js';
import { resolveLibraryDiscoveryHeartbeatConfig } from './library/library-discovery-heartbeat-config.js';

export function createSystemService({
  libraryDiscoveryHeartbeatConfig = resolveLibraryDiscoveryHeartbeatConfig(),
  startedAt,
  packageJsonPath,
  dependencyHealthService = createDependencyHealthService(),
  getMigrationStatusFn = getMigrationStatus,
  getPoolFn = getPool,
  readPackageMetadataFn = async (path) => JSON.parse(await readFile(path, 'utf8')),
  settingsService = createSettingsService(),
}) {
  let packageMetadata;

  async function getPackageMetadata() {
    if (!packageMetadata) {
      packageMetadata = await readPackageMetadataFn(packageJsonPath);
    }

    return packageMetadata;
  }

  async function getOverview({ includeDependencies = true } = {}) {
    const packageJson = await getPackageMetadata();
    const settingsPayload = await settingsService.buildSettingsPayload();
    const configuredPaths = settingsPayload.settings?.paths ?? {};
    const pool = getPoolFn();
    const migrationStatus = await getMigrationStatusFn();
    const dbCheck = await pool.query('SELECT current_database() AS name');
    const dependencies = includeDependencies
      ? await dependencyHealthService.getDependencyHealth()
      : [];

    return {
      service: {
        name: 'harmoniarr',
        version: packageJson.version,
        startedAt: startedAt.toISOString(),
      },
      discoveryHeartbeat: libraryDiscoveryHeartbeatConfig,
      database: {
        name: dbCheck.rows[0]?.name ?? process.env.PGDATABASE ?? 'harmoniarr',
        appliedMigrations: migrationStatus.applied,
        pendingMigrations: migrationStatus.pending.length,
        pendingMigrationNames: migrationStatus.pending,
      },
      dependencies,
      pathValidation: createPathValidationSummary(settingsPayload),
      paths: [
        {
          label: 'App data',
          value: process.env.HARMONIARR_APPDATA ?? '/app/data',
          description: 'Persistent state, generated runtime files, and embedded PostgreSQL.',
        },
        {
          label: 'Downloads',
          value: configuredPaths.downloads ?? process.env.HARMONIARR_DOWNLOADS ?? '/data/downloads',
          description: 'Shared slskd download tree used as the import source.',
        },
        {
          label: 'Music library',
          value: configuredPaths.music ?? process.env.HARMONIARR_MUSIC ?? '/data/music',
          description: 'Final managed library root for imported releases.',
        },
        {
          label: 'Staging',
          value: configuredPaths.staging ?? process.env.HARMONIARR_STAGING ?? '/data/staging',
          description: 'Review and quarantine workspace before import.',
        },
        {
          label: 'Transcode temp',
          value: configuredPaths.transcodeTemp ?? process.env.HARMONIARR_TRANSCODE_TEMP ?? '/data/transcode-temp',
          description: 'Scratch space reserved for future media processing jobs.',
        },
      ],
    };
  }
  return {
    getOverview,
  };
}
