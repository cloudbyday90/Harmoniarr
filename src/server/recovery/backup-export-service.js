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

import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { getMigrationStatus } from '../migrations.js';
import { loadSettings } from '../settings.js';
import { createBackupManifestService } from './backup-manifest-service.js';
import { createBackupEncryptionService } from './backup-encryption-service.js';

function formatExportTimestamp(dateValue) {
  return dateValue.toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function toMigrationLevel(status) {
  const pending = Array.isArray(status?.pending) ? status.pending.length : 0;
  const applied = Number.isFinite(status?.applied) ? status.applied : 0;
  return pending > 0 ? `pending:${pending}` : `applied:${applied}`;
}

function sanitizeArtifact(artifact) {
  if (!artifact) {
    return null;
  }

  return {
    appVersion: artifact.appVersion,
    backupType: artifact.backupType,
    createdAt: artifact.createdAt,
    createdByUserId: artifact.createdByUserId,
    encrypted: artifact.encrypted,
    encryptionKeyFingerprint: artifact.encryptionKeyFingerprint ?? null,
    fileSizeBytes: artifact.fileSizeBytes,
    filename: artifact.filename,
    formatVersion: artifact.formatVersion,
    id: artifact.id,
    manifest: artifact.manifest,
    migrationLevel: artifact.migrationLevel,
    payloadSha256: artifact.payloadSha256,
    scope: artifact.scope,
  };
}

function resolveArtifactStoragePath({ artifact, backupsDirectory }) {
  if (!artifact?.storagePath || typeof artifact.storagePath !== 'string') {
    throw createApiError(409, 'backup_artifact_storage_path_invalid', 'Backup artifact storage path is not valid');
  }

  const resolvedBackupsDirectory = resolve(backupsDirectory);
  const resolvedStoragePath = resolve(artifact.storagePath);
  const relativePath = relative(resolvedBackupsDirectory, resolvedStoragePath);

  if (isAbsolute(relativePath) || relativePath.startsWith('..') || relativePath === '') {
    throw createApiError(409, 'backup_artifact_storage_path_invalid', 'Backup artifact storage path is outside the managed backup directory');
  }

  return resolvedStoragePath;
}

function buildScopeSettings({
  manualOverrides,
  operatorArtistMonitoring,
  operatorReleaseGroupSelections,
  operatorTrackOverrides,
  settingsSnapshot = {},
  sourceUsers,
  wantedReleases,
}) {
  return {
    mediaManagement: {
      artwork: settingsSnapshot.artwork,
      qualityProfiles: settingsSnapshot.quality,
    },
    monitoring: {
      operatorArtistMonitoring,
      operatorReleaseGroupSelections,
      operatorTrackOverrides,
    },
    pathMappings: {
      paths: settingsSnapshot.paths,
    },
    providers: {
      providers: settingsSnapshot.providers,
      slskd: settingsSnapshot.slskd,
    },
    settings: settingsSnapshot,
    overrides: {
      manualOverrides,
    },
    trust: {
      sourceUsers,
    },
    wanted: {
      wantedReleases,
    },
  };
}

export function createBackupExportService({
  backupsDirectory = process.env.HARMONIARR_BACKUPS ?? '/app/data/backups',
  getBackupArtifactById = async () => null,
  getMigrationStatusFn = getMigrationStatus,
  listBackupArtifacts = async () => [],
  listOverridesSnapshotForBackup = async () => [],
  listOperatorArtistMonitoringForBackup = async () => [],
  listOperatorReleaseGroupSelectionsForBackup = async () => [],
  listOperatorTrackOverridesForBackup = async () => [],
  listTrustSnapshotForBackup = async () => [],
  listWantedReleasesForBackup = async () => [],
  loadSettingsFn = loadSettings,
  readPackageMetadataFn = async (path) => JSON.parse(await readFile(path, 'utf8')),
  packageJsonPath,
  recordAuditEventFn = recordAuditEvent,
  backupManifestService = createBackupManifestService(),
  backupEncryptionService = createBackupEncryptionService(),
  backupArtifactFileOperationService = null,
  randomUuidFn = randomUUID,
} = {}) {
  if (!packageJsonPath) {
    throw new Error('packageJsonPath is required');
  }

  if (!backupArtifactFileOperationService) {
    throw new Error('backupArtifactFileOperationService is required');
  }

  async function createBackupExport({ requestMetadata = null, triggeredByUserId = null } = {}) {
    await backupArtifactFileOperationService.recoverIncompleteFileOperations();

    const exportedAt = new Date();
    const exportedAtIso = exportedAt.toISOString();
    const packageMetadata = await readPackageMetadataFn(packageJsonPath);
    const settingsSnapshot = await loadSettingsFn();
    const migrationStatus = await getMigrationStatusFn();
    const [
      manualOverrides,
      operatorArtistMonitoring,
      operatorReleaseGroupSelections,
      operatorTrackOverrides,
      sourceUsers,
      wantedReleases,
    ] = await Promise.all([
      listOverridesSnapshotForBackup(),
      listOperatorArtistMonitoringForBackup(),
      listOperatorReleaseGroupSelectionsForBackup(),
      listOperatorTrackOverridesForBackup(),
      listTrustSnapshotForBackup(),
      listWantedReleasesForBackup(),
    ]);
    const migrationLevel = toMigrationLevel(migrationStatus);

    const useEncryption = backupEncryptionService.isEncryptionAvailable();
    const encrypted = useEncryption;

    const manifest = backupManifestService.buildLogicalManifest({
      appVersion: packageMetadata?.version ?? null,
      encrypted,
      exportedAt: exportedAtIso,
      migrationLevel,
      settingsSnapshot,
    });

    const backupDocument = {
      ...manifest,
      data: {
        scopeSettings: buildScopeSettings({
          manualOverrides,
          operatorArtistMonitoring,
          operatorReleaseGroupSelections,
          operatorTrackOverrides,
          settingsSnapshot,
          sourceUsers,
          wantedReleases,
        }),
        settings: settingsSnapshot,
      },
    };

    const serialized = JSON.stringify(backupDocument, null, 2);
    const payloadSha256 = createHash('sha256').update(serialized).digest('hex');

    const fileContent = useEncryption
      ? backupEncryptionService.encryptBackupPayload(serialized)
      : serialized;

    const filename = `harmoniarr_backup_${formatExportTimestamp(exportedAt)}_${randomUuidFn()}${encrypted ? '.enc' : ''}.json`;
    const storagePath = join(backupsDirectory, filename);

    const artifact = await backupArtifactFileOperationService.publishBackupArtifact({
      artifact: {
        appVersion: manifest.application.version,
        backupType: manifest.backup.type,
        createdByUserId: triggeredByUserId,
        encrypted,
        encryptionKeyFingerprint: backupEncryptionService.getKeyFingerprint(),
        fileSizeBytes: Buffer.byteLength(fileContent, 'utf8'),
        filename,
        formatVersion: manifest.formatVersion,
        manifest,
        migrationLevel: manifest.schema.migrationLevel,
        payloadSha256,
        scope: manifest.backup.scope,
        storagePath,
      },
      content: fileContent,
      triggeredByUserId,
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        backupArtifactId: artifact.id,
        encrypted: artifact.encrypted,
        fileSizeBytes: artifact.fileSizeBytes,
        filename: artifact.filename,
        formatVersion: artifact.formatVersion,
        scope: artifact.scope,
      },
      entityId: artifact.id,
      entityType: 'backup_artifact',
      eventType: 'backup_export_created',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Backup export created',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      accepted: true,
      backupArtifact: sanitizeArtifact(artifact),
    };
  }

  async function listBackupExports({ limit } = {}) {
    const artifacts = await listBackupArtifacts({ limit });

    return {
      backupArtifacts: artifacts.map(sanitizeArtifact),
      checkedAt: new Date().toISOString(),
    };
  }

  async function getBackupExportById({ backupArtifactId }) {
    const artifact = await getBackupArtifactById({ backupArtifactId });
    if (!artifact) {
      throw createApiError(404, 'backup_artifact_not_found', 'Backup artifact was not found');
    }

    return {
      backupArtifact: sanitizeArtifact(artifact),
    };
  }

  async function getBackupExportDownloadById({ backupArtifactId }) {
    const artifact = await getBackupArtifactById({ backupArtifactId });
    if (!artifact) {
      throw createApiError(404, 'backup_artifact_not_found', 'Backup artifact was not found');
    }

    const storagePath = resolveArtifactStoragePath({
      artifact,
      backupsDirectory,
    });

    let payload;
    try {
      payload = await readFile(storagePath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw createApiError(404, 'backup_artifact_payload_not_found', 'Backup artifact payload file was not found');
      }

      throw error;
    }

    return {
      backupArtifact: sanitizeArtifact(artifact),
      content: payload,
      contentType: 'application/json; charset=utf-8',
      filename: artifact.filename ?? basename(storagePath),
    };
  }

  async function deleteBackupExportById({ backupArtifactId, requestMetadata = null, triggeredByUserId = null } = {}) {
    await backupArtifactFileOperationService.recoverIncompleteFileOperations();

    const artifact = await getBackupArtifactById({ backupArtifactId });
    if (!artifact) {
      throw createApiError(404, 'backup_artifact_not_found', 'Backup artifact was not found');
    }

    const deletionResult = await backupArtifactFileOperationService.deleteBackupArtifact({
      artifact: {
        ...artifact,
        storagePath: resolveArtifactStoragePath({ artifact, backupsDirectory }),
      },
      triggeredByUserId,
    });
    const resolvedDeletedArtifact = deletionResult.backupArtifact ?? artifact;

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        backupArtifactId: resolvedDeletedArtifact.id,
        fileDeleted: deletionResult.fileDeleted,
        filename: resolvedDeletedArtifact.filename,
      },
      entityId: resolvedDeletedArtifact.id,
      entityType: 'backup_artifact',
      eventType: 'backup_export_deleted',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Backup export deleted',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      accepted: true,
      backupArtifact: sanitizeArtifact(resolvedDeletedArtifact),
      fileDeleted: deletionResult.fileDeleted,
    };
  }

  return {
    createBackupExport,
    deleteBackupExportById,
    getBackupExportById,
    getBackupExportDownloadById,
    listBackupExports,
  };
}
