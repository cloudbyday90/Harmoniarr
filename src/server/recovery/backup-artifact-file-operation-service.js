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
import { createApiError } from '../auth.js';
import {
  createBackupArtifactFileService,
  createTemporaryBackupArtifactPath,
} from './backup-artifact-file-service.js';
import { createBackupArtifactFileVerificationService } from './backup-artifact-file-verification-service.js';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isArtifactIdentityMatch(existingArtifact, expectedArtifact) {
  return existingArtifact?.filename === expectedArtifact?.filename
    && existingArtifact?.storagePath === expectedArtifact?.storagePath
    && existingArtifact?.payloadSha256 === expectedArtifact?.payloadSha256
    && existingArtifact?.fileSizeBytes === expectedArtifact?.fileSizeBytes
    && existingArtifact?.formatVersion === expectedArtifact?.formatVersion
    && existingArtifact?.backupType === expectedArtifact?.backupType;
}

function createVerificationRequiredError(code) {
  return createApiError(
    409,
    'backup_artifact_filesystem_confirmation_required',
    `Backup artifact filesystem state could not be verified (${code}). No file was changed.`,
  );
}

function getErrorDetails(error) {
  return {
    code: typeof error?.code === 'string' && error.code.length > 0
      ? error.code
      : 'backup_artifact_file_operation_failed',
    message: error instanceof Error ? error.message : 'Backup artifact file operation failed',
  };
}

function toOperationArtifact(operation, storagePath) {
  return {
    ...operation.artifactSnapshot,
    storagePath,
  };
}

/**
 * Coordinates durable intent, verified local filesystem changes, and backup
 * inventory metadata. The database record deliberately precedes every file
 * mutation because PostgreSQL cannot atomically commit a filesystem operation.
 */
export function createBackupArtifactFileOperationService({
  backupArtifactFileService = createBackupArtifactFileService(),
  backupArtifactFileVerificationService = createBackupArtifactFileVerificationService(),
  createBackupArtifact = async () => {
    throw new Error('createBackupArtifact dependency is required');
  },
  createFileOperation = async () => {
    throw new Error('createFileOperation dependency is required');
  },
  deleteBackupArtifactById = async () => null,
  getBackupArtifactByFilename = async () => null,
  getBackupArtifactById = async () => null,
  listIncompleteFileOperations = async () => [],
  randomUuidFn = randomUUID,
  sha256Fn = sha256,
  updateFileOperation = async () => {
    throw new Error('updateFileOperation dependency is required');
  },
} = {}) {
  async function verifyOperationArtifact(operation, storagePath) {
    return backupArtifactFileVerificationService.verifyBackupArtifactFile({
      artifact: toOperationArtifact(operation, storagePath),
      expectedFileSha256: operation.expectedFileSha256,
      expectedFileSizeBytes: operation.expectedFileSizeBytes,
      storagePath,
    });
  }

  async function holdForConfirmation(operation, verification) {
    await updateFileOperation({
      fileOperationId: operation.id,
      lastErrorCode: verification.code,
      lastErrorMessage: 'Filesystem content does not match the durable backup artifact record',
      status: 'awaiting_confirmation',
    });

    return {
      code: verification.code,
      status: 'awaiting_confirmation',
    };
  }

  async function findOrCreateArtifact(operation) {
    const expectedArtifact = operation.artifactSnapshot;
    const existingArtifact = operation.backupArtifactId
      ? await getBackupArtifactById({ backupArtifactId: operation.backupArtifactId })
      : await getBackupArtifactByFilename({ filename: expectedArtifact.filename });

    if (existingArtifact) {
      if (!isArtifactIdentityMatch(existingArtifact, expectedArtifact)) {
        await holdForConfirmation(operation, { code: 'artifact_inventory_mismatch' });
        throw createVerificationRequiredError('artifact_inventory_mismatch');
      }

      return existingArtifact;
    }

    return createBackupArtifact(expectedArtifact);
  }

  async function completePublication(operation) {
    const artifact = await findOrCreateArtifact(operation);
    await updateFileOperation({
      backupArtifactId: artifact.id,
      fileOperationId: operation.id,
      status: 'completed',
    });
    return artifact;
  }

  async function publishPreparedOperation(operation) {
    const finalVerification = await verifyOperationArtifact(operation, operation.storagePath);
    if (finalVerification.status === 'verified') {
      await updateFileOperation({
        fileOperationId: operation.id,
        status: 'finalized',
      });
      return completePublication(operation);
    }

    if (finalVerification.status === 'unverified') {
      await holdForConfirmation(operation, finalVerification);
      throw createVerificationRequiredError(finalVerification.code);
    }

    const temporaryPath = operation.temporaryPath;
    if (!temporaryPath) {
      await updateFileOperation({
        fileOperationId: operation.id,
        lastErrorCode: 'temporary_path_missing',
        lastErrorMessage: 'Publication intent has no temporary file path',
        status: 'abandoned',
      });
      return null;
    }

    const temporaryVerification = await verifyOperationArtifact(operation, temporaryPath);
    if (temporaryVerification.status === 'missing') {
      await updateFileOperation({
        fileOperationId: operation.id,
        lastErrorCode: 'artifact_file_missing',
        lastErrorMessage: 'Neither the final nor temporary backup artifact file exists',
        status: 'abandoned',
      });
      return null;
    }

    if (temporaryVerification.status !== 'verified') {
      await holdForConfirmation(operation, temporaryVerification);
      throw createVerificationRequiredError(temporaryVerification.code);
    }

    await backupArtifactFileService.promoteTemporaryFile({
      storagePath: operation.storagePath,
      temporaryPath,
    });

    const promotedVerification = await verifyOperationArtifact(operation, operation.storagePath);
    if (promotedVerification.status !== 'verified') {
      await holdForConfirmation(operation, promotedVerification);
      throw createVerificationRequiredError(promotedVerification.code);
    }

    await updateFileOperation({
      fileOperationId: operation.id,
      status: 'finalized',
    });
    return completePublication(operation);
  }

  async function deletePreparedOperation(operation) {
    const verification = await verifyOperationArtifact(operation, operation.storagePath);
    if (verification.status === 'unverified') {
      await holdForConfirmation(operation, verification);
      throw createVerificationRequiredError(verification.code);
    }

    let fileDeleted = false;
    if (verification.status === 'verified') {
      fileDeleted = (await backupArtifactFileService.removeFileIfPresent({ storagePath: operation.storagePath })).removed;
    }

    await updateFileOperation({
      fileOperationId: operation.id,
      status: 'finalized',
    });

    const backupArtifactId = operation.backupArtifactId;
    const deletedArtifact = backupArtifactId
      ? await deleteBackupArtifactById({ backupArtifactId })
      : null;
    const resolvedArtifact = deletedArtifact ?? operation.artifactSnapshot;

    await updateFileOperation({
      backupArtifactId,
      fileOperationId: operation.id,
      status: 'completed',
    });

    return {
      backupArtifact: resolvedArtifact,
      fileDeleted,
    };
  }

  async function publishBackupArtifact({ artifact, content, triggeredByUserId = null } = {}) {
    const expectedFileSizeBytes = Buffer.byteLength(content);
    const expectedFileSha256 = sha256Fn(content);
    const temporaryPath = createTemporaryBackupArtifactPath({
      storagePath: artifact.storagePath,
      token: randomUuidFn(),
    });
    const operation = await createFileOperation({
      artifactSnapshot: artifact,
      createdByUserId: triggeredByUserId,
      expectedFileSha256,
      expectedFileSizeBytes,
      filename: artifact.filename,
      operationType: 'publish',
      storagePath: artifact.storagePath,
      temporaryPath,
    });

    try {
      await backupArtifactFileService.writePrivateTemporaryFile({ content, temporaryPath });
      const temporaryVerification = await verifyOperationArtifact(operation, temporaryPath);
      if (temporaryVerification.status !== 'verified') {
        await holdForConfirmation(operation, temporaryVerification);
        throw createVerificationRequiredError(temporaryVerification.code);
      }

      await updateFileOperation({
        fileOperationId: operation.id,
        status: 'temporary_ready',
      });
      return publishPreparedOperation(operation);
    } catch (error) {
      if (error?.code !== 'backup_artifact_filesystem_confirmation_required') {
        const details = getErrorDetails(error);
        await updateFileOperation({
          fileOperationId: operation.id,
          lastErrorCode: details.code,
          lastErrorMessage: details.message,
          status: operation.status,
        });
      }

      throw error;
    }
  }

  async function deleteBackupArtifact({ artifact, triggeredByUserId = null } = {}) {
    const verification = await backupArtifactFileVerificationService.verifyBackupArtifactFile({ artifact });
    if (verification.status === 'unverified') {
      throw createVerificationRequiredError(verification.code);
    }

    const operation = await createFileOperation({
      artifactSnapshot: artifact,
      backupArtifactId: artifact.id,
      createdByUserId: triggeredByUserId,
      expectedFileSha256: verification.fileSha256 ?? sha256Fn(''),
      expectedFileSizeBytes: verification.fileSizeBytes ?? artifact.fileSizeBytes,
      filename: artifact.filename,
      operationType: 'delete',
      storagePath: artifact.storagePath,
    });

    try {
      return await deletePreparedOperation(operation);
    } catch (error) {
      if (error?.code !== 'backup_artifact_filesystem_confirmation_required') {
        const details = getErrorDetails(error);
        await updateFileOperation({
          fileOperationId: operation.id,
          lastErrorCode: details.code,
          lastErrorMessage: details.message,
          status: operation.status,
        });
      }

      throw error;
    }
  }

  async function recoverFileOperation(operation) {
    if (operation.status === 'awaiting_confirmation') {
      return { status: 'awaiting_confirmation' };
    }

    try {
      if (operation.operationType === 'publish') {
        const artifact = await publishPreparedOperation(operation);
        return artifact ? { artifactId: artifact.id, status: 'completed' } : { status: 'abandoned' };
      }

      if (operation.operationType === 'delete') {
        const result = await deletePreparedOperation(operation);
        return { artifactId: result.backupArtifact?.id ?? null, status: 'completed' };
      }

      await holdForConfirmation(operation, { code: 'operation_type_unrecognized' });
      return { status: 'awaiting_confirmation' };
    } catch (error) {
      if (error?.code === 'backup_artifact_filesystem_confirmation_required') {
        return { status: 'awaiting_confirmation' };
      }

      const details = getErrorDetails(error);
      await updateFileOperation({
        fileOperationId: operation.id,
        lastErrorCode: details.code,
        lastErrorMessage: details.message,
        status: operation.status,
      });
      return { status: 'deferred' };
    }
  }

  async function recoverIncompleteFileOperations() {
    const operations = await listIncompleteFileOperations();
    const results = [];

    for (const operation of operations) {
      results.push(await recoverFileOperation(operation));
    }

    return {
      completedCount: results.filter((result) => result.status === 'completed').length,
      deferredCount: results.filter((result) => result.status === 'deferred').length,
      awaitingConfirmationCount: results.filter((result) => result.status === 'awaiting_confirmation').length,
      abandonedCount: results.filter((result) => result.status === 'abandoned').length,
    };
  }

  return {
    deleteBackupArtifact,
    publishBackupArtifact,
    recoverIncompleteFileOperations,
  };
}
