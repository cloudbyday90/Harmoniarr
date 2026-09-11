/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';

const blockedMessages = new Map([
  ['provider_collection_page_limit', 'This collection exceeds the 50-page preparation limit. Use a smaller collection or request individual albums.'],
  ['provider_collection_item_limit', 'This collection exceeds the 1,000-item review limit. Use a smaller collection or request individual albums.'],
  ['provider_collection_snapshot_changed', 'The provider playlist changed during preparation. Restart to capture its current contents.'],
  ['provider_collection_snapshot_invalid', 'The provider did not return a usable playlist version. Check provider access before restarting.'],
  ['provider_collection_cursor_cycle', 'The provider repeated a page continuation. Preparation stopped to prevent incomplete review.'],
  ['provider_collection_cursor_invalid', 'The provider returned an invalid page continuation. Preparation stopped before skipping any items.'],
  ['provider_collection_cursor_gap', 'The provider continuation skipped expected items. Preparation stopped before accepting an incomplete selection.'],
  ['provider_collection_album_relationship_incomplete', 'The provider returned only part of a song’s album references. This collection needs provider support before preparation can finish.'],
  ['provider_collection_contents_missing', 'The provider response omitted expected collection contents. Check provider access before restarting.'],
]);

export function assertCollectionTarget(collection, request) {
  if (collection.requestedForUserId !== request.requestedForUser?.id) {
    throw createApiError(409, 'external_collection_target_changed', 'This collection belongs to the previous request target. Create a separate request for the current target.');
  }
}

export function assertCollectionRevision(collection, expectedRevision) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    throw createApiError(400, 'validation_error', 'expectedRevision must be a positive integer');
  }
  if (collection.revision !== expectedRevision) {
    throw createApiError(409, 'external_collection_stale_review', 'Collection review has changed. Refresh before saving this decision.');
  }
}

export function assertCollectionReady(collection) {
  if (collection.status !== 'ready') {
    throw createApiError(409, 'external_collection_not_ready', 'Collection preparation must finish before decisions can be saved. Reviewed collections cannot be changed.');
  }
}

export function presentCollection(collection, request) {
  const targetMatches = collection.requestedForUserId === request.requestedForUser?.id;
  return {
    status: collection.status, revision: collection.revision,
    requestedForUserId: collection.requestedForUserId, targetMatches,
    pagesCompleted: collection.pagesCompleted, itemsSeen: collection.itemsSeen,
    leafCount: collection.leafCount, includedCount: collection.includedCount,
    excludedCount: collection.excludedCount, pendingCount: collection.pendingCount,
    blockedReason: collection.blockedReason ? blockedMessages.get(collection.blockedReason)
      ?? 'The provider returned collection details that cannot be safely prepared. Check provider access before restarting.' : null,
    reviewedAt: collection.reviewedAt,
    canFinalize: targetMatches && collection.status === 'ready' && collection.pendingCount === 0 && collection.includedCount > 0,
    canRestart: targetMatches && collection.status === 'blocked' && collection.includedCount === 0 && collection.excludedCount === 0,
  };
}
