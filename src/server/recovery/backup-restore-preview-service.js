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
import { readFile } from 'node:fs/promises';
import { createApiError } from '../auth.js';
import { createControlPlaneRedactionService } from '../control-plane-redaction-service.js';
import { getMigrationStatus } from '../migrations.js';
import { createBackupEncryptionService } from './backup-encryption-service.js';

function toIsoDate(value) {
  return value?.toISOString?.() ?? value ?? null;
}

function toSafeBackupArtifact(artifact) {
  return {
    id: artifact.id,
    filename: artifact.filename,
    backupType: artifact.backupType,
    formatVersion: artifact.formatVersion,
    migrationLevel: artifact.migrationLevel,
    scope: Array.isArray(artifact.scope) ? artifact.scope : [],
    createdAt: artifact.createdAt,
    createdByUserId: artifact.createdByUserId,
    encrypted: artifact.encrypted,
    appVersion: artifact.appVersion,
    fileSizeBytes: artifact.fileSizeBytes,
  };
}

function parseMigrationLevel(migrationLevel) {
  if (typeof migrationLevel !== 'string') {
    return { kind: 'unknown', count: null };
  }

  const [kind, countText] = migrationLevel.split(':');
  const normalizedKind = kind === 'applied' || kind === 'pending' ? kind : null;
  const parsedCount = Number.parseInt(countText, 10);

  if (!normalizedKind || !Number.isInteger(parsedCount) || parsedCount < 0) {
    return { kind: 'unknown', count: null };
  }

  return {
    kind: normalizedKind,
    count: parsedCount,
  };
}

function toCurrentMigrationLevel(status) {
  const pendingCount = Array.isArray(status?.pending) ? status.pending.length : 0;
  const appliedCount = Number.isInteger(status?.applied) ? status.applied : 0;

  if (pendingCount > 0) {
    return `pending:${pendingCount}`;
  }

  return `applied:${appliedCount}`;
}

function createPayloadSha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function buildMigrationCompatibilityChecks({ backupMigrationLevel, currentMigrationLevel }) {
  const checks = [];
  const backupLevel = parseMigrationLevel(backupMigrationLevel);
  const currentLevel = parseMigrationLevel(currentMigrationLevel);

  if (backupLevel.kind === 'unknown') {
    checks.push({
      code: 'backup_migration_level_unrecognized',
      status: 'failed',
      message: 'Backup migration level is missing or not recognized.',
    });

    return checks;
  }

  if (backupLevel.kind === 'pending') {
    checks.push({
      code: 'backup_contains_pending_migrations',
      status: 'failed',
      message: 'Backup artifact was captured while migrations were pending.',
    });

    return checks;
  }

  if (currentLevel.kind !== 'applied') {
    checks.push({
      code: 'runtime_migration_state_not_ready',
      status: 'failed',
      message: 'Runtime migration state is not ready for compatibility evaluation.',
    });

    return checks;
  }

  if (backupLevel.count > currentLevel.count) {
    checks.push({
      code: 'backup_requires_newer_schema',
      status: 'failed',
      message: 'Backup artifact requires a newer schema level than the current runtime.',
    });

    return checks;
  }

  checks.push({
    code: 'migration_level_compatible',
    status: 'passed',
    message: 'Backup migration level is compatible with the current runtime schema.',
  });

  return checks;
}

export function createBackupRestorePreviewService({
  controlPlaneRedactionService = createControlPlaneRedactionService(),
  getBackupArtifactById = async () => null,
  getMigrationStatusFn = getMigrationStatus,
  listRestoreApplyBlockingLocks = async () => [],
  nowFn = () => new Date(),
  readBackupPayloadFn = (storagePath) => readFile(storagePath, 'utf8'),
  sha256Fn = createPayloadSha256,
  backupEncryptionService = createBackupEncryptionService(),
} = {}) {
  async function getBackupRestorePreview({ backupArtifactId }) {
    const artifact = await getBackupArtifactById({ backupArtifactId });
    if (!artifact) {
      throw createApiError(404, 'backup_artifact_not_found', 'Backup artifact was not found');
    }

    if (!artifact.storagePath) {
      throw createApiError(500, 'backup_artifact_storage_unavailable', 'Backup artifact storage path is unavailable');
    }

    const checks = [];
    let serializedPayload;
    try {
      serializedPayload = await readBackupPayloadFn(artifact.storagePath);
    } catch {
      throw createApiError(500, 'backup_artifact_unreadable', 'Backup artifact could not be read');
    }

    const decryptionResult = backupEncryptionService.detectAndDecrypt(serializedPayload);

    if (decryptionResult.encrypted && !backupEncryptionService.isEncryptionAvailable()) {
      checks.push({
        code: 'payload_encrypted_no_key',
        status: 'failed',
        message: 'Backup artifact is encrypted but no decryption key is configured.',
      });

      const blockingLocks = await listRestoreApplyBlockingLocks();

      return {
        checkedAt: toIsoDate(nowFn()),
        backupArtifact: toSafeBackupArtifact(artifact),
        integrity: {
          status: 'failed',
          expectedPayloadSha256: artifact.payloadSha256 ?? null,
          actualPayloadSha256: null,
        },
        compatibility: {
          compatible: false,
          backupMigrationLevel: artifact.migrationLevel,
          currentMigrationLevel: null,
          checks,
        },
        restoreReadiness: {
          blockedByLock: blockingLocks.length > 0,
          blockingLocks: blockingLocks.map((lock) => controlPlaneRedactionService.redactMaintenanceLock(lock)),
        },
        canApplyRestore: false,
      };
    }

    const plaintextPayload = decryptionResult.decrypted;

    const actualPayloadSha256 = sha256Fn(plaintextPayload);
    const expectedPayloadSha256 = artifact.payloadSha256 ?? null;
    if (!expectedPayloadSha256) {
      checks.push({
        code: 'payload_checksum_missing',
        status: 'failed',
        message: 'Backup artifact checksum is missing from metadata.',
      });
    } else if (expectedPayloadSha256 !== actualPayloadSha256) {
      checks.push({
        code: 'payload_checksum_mismatch',
        status: 'failed',
        message: 'Backup artifact payload checksum does not match persisted metadata.',
      });
    } else {
      checks.push({
        code: 'payload_checksum_match',
        status: 'passed',
        message: 'Backup artifact payload checksum matches persisted metadata.',
      });
    }

    let parsedPayload = null;
    try {
      parsedPayload = JSON.parse(plaintextPayload);
      checks.push({
        code: 'payload_json_parseable',
        status: 'passed',
        message: 'Backup artifact payload is valid JSON.',
      });
    } catch {
      checks.push({
        code: 'payload_json_unparseable',
        status: 'failed',
        message: 'Backup artifact payload is not valid JSON.',
      });
    }

    if (parsedPayload) {
      if (parsedPayload.formatVersion !== artifact.formatVersion) {
        checks.push({
          code: 'format_version_mismatch',
          status: 'failed',
          message: 'Backup payload format version does not match artifact metadata.',
        });
      } else {
        checks.push({
          code: 'format_version_match',
          status: 'passed',
          message: 'Backup payload format version matches artifact metadata.',
        });
      }

      if (parsedPayload.backup?.type !== artifact.backupType) {
        checks.push({
          code: 'backup_type_mismatch',
          status: 'failed',
          message: 'Backup payload type does not match artifact metadata.',
        });
      } else {
        checks.push({
          code: 'backup_type_match',
          status: 'passed',
          message: 'Backup payload type matches artifact metadata.',
        });
      }
    }

    const currentMigrationStatus = await getMigrationStatusFn();
    const currentMigrationLevel = toCurrentMigrationLevel(currentMigrationStatus);
    const compatibilityChecks = [
      ...checks,
      ...buildMigrationCompatibilityChecks({
        backupMigrationLevel: artifact.migrationLevel,
        currentMigrationLevel,
      }),
    ];

    const blockingLocks = await listRestoreApplyBlockingLocks();
    const blockedByLock = blockingLocks.length > 0;

    const integrityPassed = checks.every((check) => check.status === 'passed');
    const compatibilityPassed = compatibilityChecks.every((check) => check.status === 'passed');

    return {
      checkedAt: toIsoDate(nowFn()),
      backupArtifact: toSafeBackupArtifact(artifact),
      integrity: {
        status: integrityPassed ? 'passed' : 'failed',
        expectedPayloadSha256,
        actualPayloadSha256,
      },
      compatibility: {
        compatible: compatibilityPassed,
        backupMigrationLevel: artifact.migrationLevel,
        currentMigrationLevel,
        checks: compatibilityChecks,
      },
      restoreReadiness: {
        blockedByLock,
        blockingLocks: blockingLocks.map((lock) => controlPlaneRedactionService.redactMaintenanceLock(lock)),
      },
      canApplyRestore: integrityPassed && compatibilityPassed && !blockedByLock,
    };
  }

  return {
    getBackupRestorePreview,
  };
}
