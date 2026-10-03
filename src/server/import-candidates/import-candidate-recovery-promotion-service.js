/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { createImportCandidateMusicQueueSelectionGuard } from './import-candidate-music-queue-selection-guard.js';
import { getImportCandidateById, promoteImportCandidateForRecovery } from './import-candidate-repository.js';

/** Recovery promotion participates in the same discovery-before-candidate selection transaction. */
export function createImportCandidateRecoveryPromotionService({
  getImportCandidateByIdFn = getImportCandidateById,
  promoteImportCandidateForRecoveryFn = promoteImportCandidateForRecovery,
  musicQueueSelectionGuard = createImportCandidateMusicQueueSelectionGuard(),
  withTransaction = createDatabaseTransactionRunner(),
} = {}) {
  for (const [name, dependency] of Object.entries({ getImportCandidateByIdFn, promoteImportCandidateForRecoveryFn,
    findActiveSelection: musicQueueSelectionGuard?.findActiveSelection, withTransaction })) {
    if (typeof dependency !== 'function') throw new TypeError(`createImportCandidateRecoveryPromotionService requires ${name}`);
  }
  async function promoteRecoveryCandidate(input) {
    return withTransaction(async (client) => {
      const candidate = await getImportCandidateByIdFn(input.importCandidateId, client);
      if (!candidate || !['pending', 'held'].includes(candidate.status)) return null;
      const metadataReleaseId = candidate.normalizedPayload?.discoveryScope?.metadataReleaseId
        ?? candidate.normalizedPayload?.requestOwnership?.metadataReleaseId ?? null;
      if (await musicQueueSelectionGuard.findActiveSelection({ candidate, client, metadataReleaseId })) return null;
      return promoteImportCandidateForRecoveryFn(input, client);
    });
  }
  return { promoteRecoveryCandidate };
}
