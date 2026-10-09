/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

export function getMissingMusicDownloadReviewReference(release) {
  const handoff = release?.discoveryRequest?.importReviewSummary?.currentDownloadHandoff;
  if (handoff?.confirmationPending !== true || typeof handoff.operationRunId !== 'string' || !handoff.operationRunId.trim()
    || typeof handoff.importCandidateId !== 'string' || !handoff.importCandidateId.trim()) return null;
  return { operationRunId: handoff.operationRunId, importCandidateId: handoff.importCandidateId };
}

export function canReviewMissingMusicDownload({ actorUser, targetUser, release } = {}) {
  return actorUser?.role === 'admin' && targetUser?.isDisabled !== true && targetUser?.accountStatus !== 'disabled'
    && getMissingMusicDownloadReviewReference(release) != null;
}
