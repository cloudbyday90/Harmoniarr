/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createBackupArtifactRepository } from './backup-artifact-repository.js';
import { createBackupArtifactFileOperationStore } from './backup-artifact-file-operation-store.js';
import { createBackupArtifactFileOperationService } from './backup-artifact-file-operation-service.js';
import { createBackupArtifactFileService } from './backup-artifact-file-service.js';
import { createBackupArtifactFileReadinessService } from './backup-artifact-file-readiness-service.js';
import { createBackupArtifactOwnershipStore } from './backup-artifact-ownership-store.js';
import { backupArtifactDrainGate } from './backup-artifact-drain-gate.js';

export function createOwnedBackupArtifactService({
  backupArtifactRepository = createBackupArtifactRepository(),
  backupArtifactFileOperationStore = createBackupArtifactFileOperationStore(),
  ownershipStore = createBackupArtifactOwnershipStore(),
  createFileService = createBackupArtifactFileService,
  createReadinessService = createBackupArtifactFileReadinessService,
  drainGate = backupArtifactDrainGate,
  onJournalFailure,
} = {}) {
  function run(method, input, onBusy) {
    return drainGate.run(() => ownershipStore.withOwnership(async ({ queryable, assertOwnership }) => {
      const bind = fn => async value => {
        await assertOwnership();
        return fn(value, queryable);
      };
      const service = createBackupArtifactFileOperationService({
        onJournalFailure,
        backupArtifactFileService: createFileService({ assertOwnership }),
        backupArtifactFileReadinessService: createReadinessService({ assertOwnership }),
        createBackupArtifact: bind(backupArtifactRepository.createBackupArtifact),
        getBackupArtifactByFilename: bind(backupArtifactRepository.getBackupArtifactByFilename),
        getBackupArtifactById: bind(backupArtifactRepository.getBackupArtifactById),
        deleteBackupArtifactById: bind(backupArtifactRepository.deleteBackupArtifactById),
        createFileOperation: bind(backupArtifactFileOperationStore.createFileOperation),
        updateFileOperation: bind(backupArtifactFileOperationStore.updateFileOperation),
        recordFileOperationFailure: bind(backupArtifactFileOperationStore.recordFileOperationFailure),
        listIncompleteFileOperations: async () => {
          await assertOwnership();
          return backupArtifactFileOperationStore.listIncompleteFileOperations(queryable);
        },
      });
      return service[method](input);
    }, { onBusy }), { onBusy });
  }
  return {
    publishBackupArtifact: input => run('publishBackupArtifact', input),
    deleteBackupArtifact: input => run('deleteBackupArtifact', input),
    recoverIncompleteFileOperations: () => run('recoverIncompleteFileOperations', undefined, () => ({
      abandonedCount: 0,
      awaitingConfirmationCount: 0,
      completedCount: 0,
      deferredCount: 0,
      ownershipBusy: true,
    })),
  };
}
