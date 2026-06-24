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
import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { createOperationRunStore } from '../operation-run-store.js';
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';
import { createBackupEncryptionService } from './backup-encryption-service.js';
import { createBackupRestoreScopeApplyService } from './backup-restore-scope-apply-service.js';

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
    encryptionKeyFingerprint: artifact.encryptionKeyFingerprint ?? null,
    appVersion: artifact.appVersion,
    fileSizeBytes: artifact.fileSizeBytes,
    payloadSha256: artifact.payloadSha256,
  };
}

function normalizeErrorCode(error) {
  if (error?.code && typeof error.code === 'string' && error.code.trim().length > 0) {
    return error.code;
  }

  return 'backup_restore_apply_failed';
}

export function createBackupRestoreApplyService({
  acquireMaintenanceLock = async () => {
    throw new Error('acquireMaintenanceLock dependency is required');
  },
  createOperationRun = null,
  getBackupArtifactById = async () => null,
  getBackupRestorePreview = async () => {
    throw new Error('getBackupRestorePreview dependency is required');
  },
  getOperationRunById = null,
  markRunCompleted = null,
  markRunFailed = null,
  markRunStarted = null,
  onReleaseMaintenanceLockError = async () => {},
  readBackupPayloadFn = (storagePath) => readFile(storagePath, 'utf8'),
  replaceOverridesSnapshot = async () => {},
  replaceLibraryWantedReleases = async () => {},
  replaceOperatorArtistMonitoring = async () => {},
  replaceOperatorReleaseGroupSelections = async () => {},
  replaceOperatorTrackOverrides = async () => {},
  replaceTrustSnapshot = async () => {},
  recordAuditEventFn = recordAuditEvent,
  releaseMaintenanceLock = async () => null,
  updateSettingsFn = async () => {
    throw new Error('updateSettingsFn dependency is required');
  },
  backupEncryptionService = createBackupEncryptionService(),
} = {}) {
  const operationDescriptor = operationRunRegistry.backupRestoreApply;
  const operationRunStore = createOperationRun || markRunCompleted || markRunFailed || markRunStarted || getOperationRunById
    ? null
    : createOperationRunStore({ operationType: operationDescriptor.operationType });

  const createRun = createOperationRun ?? operationRunStore?.createOperationRun;
  const markStarted = markRunStarted ?? operationRunStore?.markRunStarted;
  const markCompleted = markRunCompleted ?? operationRunStore?.markRunCompleted;
  const markFailed = markRunFailed ?? operationRunStore?.markRunFailed;
  const getRunById = getOperationRunById ?? operationRunStore?.getRunById;

  if (!createRun || !markStarted || !markCompleted || !markFailed || !getRunById) {
    throw new Error('Operation run dependencies are required');
  }

  const backupRestoreScopeApplyService = createBackupRestoreScopeApplyService({
    replaceOverridesSnapshot,
    replaceLibraryWantedReleases,
    replaceOperatorArtistMonitoring,
    replaceOperatorReleaseGroupSelections,
    replaceOperatorTrackOverrides,
    replaceTrustSnapshot,
    updateSettingsFn,
  });

  async function startBackupRestoreApply({
    backupArtifactId,
    expectedPayloadSha256 = null,
    requestMetadata = null,
    triggeredByUserId = null,
  } = {}) {
    const artifact = await getBackupArtifactById({ backupArtifactId });
    if (!artifact) {
      throw createApiError(404, 'backup_artifact_not_found', 'Backup artifact was not found');
    }

    if (
      typeof expectedPayloadSha256 === 'string'
      && expectedPayloadSha256.trim().length > 0
      && expectedPayloadSha256.trim() !== artifact.payloadSha256
    ) {
      throw createApiError(409, 'backup_restore_stale_manifest', 'Backup artifact no longer matches the expected payload checksum');
    }

    const preview = await getBackupRestorePreview({ backupArtifactId });
    if (!preview?.canApplyRestore) {
      if (preview?.restoreReadiness?.blockedByLock) {
        throw createApiError(409, 'recovery_lock_conflict', 'A conflicting maintenance lock prevents restore apply');
      }

      throw createApiError(409, 'backup_restore_not_ready', 'Backup restore preflight checks failed');
    }

    const run = await createRun({
      status: 'pending',
      summary: {
        backupArtifactId,
        currentStep: 'Restore apply queued',
      },
      triggeredByUserId,
    });

    let lock = null;
    let responseBody = null;
    let thrownError = null;
    let restoreCompleted = false;

    try {
      await markStarted({
        runId: run.id,
        summary: {
          backupArtifactId,
          currentStep: 'Restore apply started',
        },
      });

      lock = await acquireMaintenanceLock({
        acquiredByUserId: triggeredByUserId,
        lockType: 'restore',
        reason: `Backup restore apply run ${run.id}`,
        status: 'active',
      });

      await recordAuditEventFn({
        actorType: triggeredByUserId ? 'user' : 'system',
        actorUserId: triggeredByUserId,
        details: {
          backupArtifactId,
          lockId: lock?.id ?? null,
          runId: run.id,
        },
        entityId: run.id,
        entityType: 'operation_run',
        eventType: operationDescriptor.startedEventType,
        ipAddress: requestMetadata?.ipAddress ?? null,
        summary: 'Backup restore apply started',
        userAgent: requestMetadata?.userAgent ?? null,
      });

      if (!artifact.storagePath) {
        throw createApiError(500, 'backup_artifact_storage_unavailable', 'Backup artifact storage path is unavailable');
      }

      const serializedPayload = await readBackupPayloadFn(artifact.storagePath);
      const decryptionResult = backupEncryptionService.detectAndDecrypt(serializedPayload);

      if (decryptionResult.encrypted && !backupEncryptionService.isEncryptionAvailable()) {
        throw createApiError(409, 'backup_restore_encrypted_no_key', 'Backup artifact is encrypted but no decryption key is configured');
      }

      let parsedPayload = null;

      try {
        parsedPayload = JSON.parse(decryptionResult.decrypted);
      } catch {
        throw createApiError(409, 'backup_restore_payload_invalid', 'Backup restore payload is not valid JSON');
      }

      const restoreResult = await backupRestoreScopeApplyService.applyRestoreScopes({
        artifactScope: artifact.scope,
        parsedPayload,
        requestMetadata,
        triggeredByUserId,
      });

      if (restoreResult.appliedScopes.length === 0) {
        throw createApiError(409, 'backup_restore_scope_payload_missing', 'Backup restore payload does not include any supported scope payloads');
      }

      await markCompleted({
        runId: run.id,
        summary: {
          backupArtifactId,
          currentStep: 'Restore apply completed',
          ...restoreResult,
        },
      });

      await recordAuditEventFn({
        actorType: triggeredByUserId ? 'user' : 'system',
        actorUserId: triggeredByUserId,
        details: {
          backupArtifactId,
          lockId: lock?.id ?? null,
          runId: run.id,
          ...restoreResult,
        },
        entityId: run.id,
        entityType: 'operation_run',
        eventType: 'backup_restore_completed',
        ipAddress: requestMetadata?.ipAddress ?? null,
        summary: 'Backup restore apply completed',
        userAgent: requestMetadata?.userAgent ?? null,
      });

      responseBody = {
        accepted: true,
        backupArtifact: toSafeBackupArtifact(artifact),
        restoreResult,
        run: await getRunById(run.id),
      };
      restoreCompleted = true;
    } catch (error) {
      thrownError = error;
      await markFailed({
        runId: run.id,
        errorMessage: error instanceof Error ? error.message : 'Backup restore apply failed',
        summary: {
          backupArtifactId,
          currentStep: 'Restore apply failed',
          errorCode: normalizeErrorCode(error),
        },
      });

      await recordAuditEventFn({
        actorType: triggeredByUserId ? 'user' : 'system',
        actorUserId: triggeredByUserId,
        details: {
          backupArtifactId,
          errorCode: normalizeErrorCode(error),
          errorMessage: error instanceof Error ? error.message : 'Backup restore apply failed',
          lockId: lock?.id ?? null,
          runId: run.id,
        },
        entityId: run.id,
        entityType: 'operation_run',
        eventType: 'backup_restore_failed',
        ipAddress: requestMetadata?.ipAddress ?? null,
        summary: 'Backup restore apply failed',
        userAgent: requestMetadata?.userAgent ?? null,
      });
    } finally {
      if (lock?.id) {
        try {
          await releaseMaintenanceLock({
            lockId: lock.id,
            status: 'released',
          });
        } catch (releaseError) {
          await onReleaseMaintenanceLockError(releaseError, {
            backupArtifactId,
            lockId: lock.id,
            restoreCompleted,
            runId: run.id,
          });
          if (!thrownError && !restoreCompleted) {
            thrownError = releaseError;
          }
        }
      }
    }

    if (thrownError) {
      throw thrownError;
    }

    return responseBody;
  }

  return {
    startBackupRestoreApply,
  };
}
