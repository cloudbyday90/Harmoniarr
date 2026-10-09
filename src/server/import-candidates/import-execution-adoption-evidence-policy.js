/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { evaluateStoredDownloadReceipt, normalizeDownloadTransferId } from '../slskd/slskd-download-attempt-policy.js';

/** This is an operator's independent tracking decision, never an original POST receipt. */
export function evaluateStoredDownloadAdoption({ adoption, importCandidateId, operationRunId, requestedFiles, username } = {}) {
  if (adoption?.source !== 'operator_adoption' || !normalizeDownloadTransferId(adoption.adoptionId)
    || adoption.adoptionId !== adoption.proof?.attemptId || typeof adoption.actorUserId !== 'string'
    || !adoption.actorUserId || !/^[a-f0-9]{64}$/u.test(adoption.requestHash ?? '')
    || adoption.originalUncertainty !== true || adoption.automaticRecoveryAllowed !== false) return null;
  const proof = evaluateStoredDownloadReceipt({ attempt: adoption.proof, importCandidateId, operationRunId, requestedFiles, username });
  if (!proof || proof.attempt.receiptOrigin !== 'operator_adoption' || proof.disposition !== 'confirmed'
    || !proof.allRequestedFilesMatched) return null;
  return { ...proof, source: 'operator_adoption', disposition: 'operator_adopted', adopted: true };
}

export function hasDownloadAdoptionMarker(execution) {
  return Object.hasOwn(execution?.handoff ?? {}, 'adoption');
}
