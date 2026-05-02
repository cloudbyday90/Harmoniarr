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

const backupFormatVersion = '1';
const logicalBackupScopes = Object.freeze([
  'settings',
  'providers',
  'pathMappings',
  'mediaManagement',
  'qualityProfiles',
  'monitoring',
  'wanted',
  'trust',
  'overrides',
]);

function toCounts(settingsSnapshot = {}) {
  return {
    pathMappings: Array.isArray(settingsSnapshot?.paths?.downloadMappings)
      ? settingsSnapshot.paths.downloadMappings.length
      : 0,
    settingsNamespaces: Object.keys(settingsSnapshot).length,
    userMusicRoots: Array.isArray(settingsSnapshot?.paths?.userMusicRoots)
      ? settingsSnapshot.paths.userMusicRoots.length
      : 0,
  };
}

export function createBackupManifestService() {
  function buildLogicalManifest({ appVersion = null, exportedAt, migrationLevel = null, settingsSnapshot = {} }) {
    return {
      application: {
        name: 'harmoniarr',
        version: appVersion,
      },
      authRecovery: {
        bootstrapRecoveryRequired: true,
        interactiveAuthIncluded: false,
      },
      backup: {
        encrypted: false,
        scope: logicalBackupScopes,
        type: 'logical',
      },
      counts: toCounts(settingsSnapshot),
      exportedAt,
      formatVersion: backupFormatVersion,
      schema: {
        migrationLevel,
      },
    };
  }

  return {
    backupFormatVersion,
    buildLogicalManifest,
    logicalBackupScopes,
  };
}
