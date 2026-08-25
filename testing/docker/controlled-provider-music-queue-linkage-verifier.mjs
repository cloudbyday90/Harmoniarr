/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from 'node:assert/strict';

function getCandidateTransferLinkages(queue, candidateId) {
  return Array.isArray(queue?.transfers)
    ? queue.transfers
      .filter((transfer) => transfer?.diagnostics?.importLinkage?.candidateId === candidateId)
      .map((transfer) => transfer.diagnostics.importLinkage)
    : [];
}

function assertScopedTransferLinkage({
  candidateId,
  linkage,
  sharedSeed,
  wantedReleaseId,
}) {
  assert.equal(linkage?.candidateId, candidateId, 'the Downloader transfer must retain its import-candidate link');
  assert.equal(linkage?.status, 'linked', 'the Downloader transfer must expose a durable import-candidate link');
  assert.equal(
    linkage?.musicQueueRelease?.wantedReleaseId,
    wantedReleaseId,
    'the Downloader transfer must resolve only the current operator\'s Music Queue release',
  );

  const linkagePayload = JSON.stringify(linkage);
  for (const { wantedReleaseId: siblingWantedReleaseId } of sharedSeed.wantedReleases) {
    if (siblingWantedReleaseId !== wantedReleaseId) {
      assert.equal(
        linkagePayload.includes(siblingWantedReleaseId),
        false,
        'the Downloader link must not expose a sibling Music Queue release identity',
      );
    }
  }
  for (const { appUserId } of sharedSeed.wantedReleases) {
    assert.equal(
      linkagePayload.includes(appUserId),
      false,
      'the Downloader link must not expose an operator identity',
    );
  }
  for (const privatePolicyMarker of sharedSeed.privatePolicyMarkers) {
    assert.equal(
      linkagePayload.includes(privatePolicyMarker),
      false,
      'the Downloader link must not expose private operator policy data',
    );
  }
}

/**
 * Proves that a shared provider transfer resolves to the current operator's
 * Music Queue release when the packaged Downloader read model is built.
 *
 * The result is deliberately aggregate-only so the outer validation never
 * prints user, release, or provider-transfer identifiers.
 */
export async function assertSharedRecoveryDownloaderMusicQueueLinkage({
  buildDownloaderQueue,
  fallbackCandidateId,
  sharedSeed,
} = {}) {
  if (typeof buildDownloaderQueue !== 'function') {
    throw new TypeError('assertSharedRecoveryDownloaderMusicQueueLinkage requires buildDownloaderQueue');
  }
  if (typeof fallbackCandidateId !== 'string' || !fallbackCandidateId.trim()) {
    throw new TypeError('assertSharedRecoveryDownloaderMusicQueueLinkage requires fallbackCandidateId');
  }
  if (!Array.isArray(sharedSeed?.wantedReleases) || sharedSeed.wantedReleases.length < 2) {
    throw new TypeError('assertSharedRecoveryDownloaderMusicQueueLinkage requires shared operator releases');
  }

  const perOperator = await Promise.all(sharedSeed.wantedReleases.map(async ({ appUserId, wantedReleaseId }) => {
    const queue = await buildDownloaderQueue({ appUserId });
    const candidateLinkages = getCandidateTransferLinkages(queue, fallbackCandidateId);
    assert.equal(
      candidateLinkages.length,
      1,
      'each operator must see exactly one shared fallback transfer linked to the fallback candidate',
    );

    assertScopedTransferLinkage({
      candidateId: fallbackCandidateId,
      linkage: candidateLinkages[0],
      sharedSeed,
      wantedReleaseId,
    });

    return { linkedTransferCount: candidateLinkages.length };
  }));

  return {
    linkedTransferCount: perOperator.reduce((count, result) => count + result.linkedTransferCount, 0),
    operatorCount: perOperator.length,
    operatorIdentityRedacted: true,
    privatePolicyRedacted: true,
    siblingReleaseRedacted: true,
  };
}
