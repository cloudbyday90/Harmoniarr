/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { normalizeExternalMediaSource } from './external-media-source-parser.js';

export function buildExternalRequestCollectionFulfillmentStatus({ request, collection, candidates = [], intents = [] }) {
  if (request.requestKind !== 'external_url' || request.requestState === 'cancelled') return null;
  if (!collection) {
    if (intents.length || !candidates.some((candidate) => candidate.status === 'applied')) return null;
    let source;
    try { source = normalizeExternalMediaSource(request.sourceUrl); } catch { return null; }
    if (!['playlist', 'artist'].includes(source?.resourceType)) return null;
    return { code: 'under_review', label: 'Collection review', tone: 'held', occurredAt: request.updatedAt ?? null,
      detail: 'Imported albums do not establish complete coverage of this older collection. A captured and finalized selection is required for collection fulfillment.' };
  }
  if (request.requestState !== 'needs_fetch') return {
    code: request.requestState === 'failed' ? 'failed' : 'under_review', label: 'Collection needs review', tone: 'held',
    detail: 'This request is not active for acquisition. Review its state before considering collection fulfillment.', occurredAt: request.updatedAt ?? null,
  };
  const targetMatches = Boolean(request.requestedForUser?.id) && collection.requestedForUserId === request.requestedForUser.id;
  const includedIds = new Set(collection.includedIntentIds ?? []);
  const appliedIds = new Set(candidates.filter((candidate) => {
    const ownership = candidate.normalizedPayload?.requestOwnership;
    return candidate.status === 'applied' && ownership?.sourceMediaRequestId === request.id
      && ownership.sourceRequestedForUserId === request.requestedForUser?.id;
  }).map((candidate) => candidate.normalizedPayload.requestOwnership.externalRequestReleaseIntentId));
  const importedCount = [...includedIds].filter((id) => appliedIds.has(id)).length;
  const complete = targetMatches && collection.status === 'reviewed' && includedIds.size > 0 && importedCount === includedIds.size;
  let detail = `${importedCount} of ${includedIds.size} distinct included releases imported for this target. `;
  if (!targetMatches) detail = 'This captured collection belongs to a previous request target and cannot complete the current request.';
  else if (complete) detail += 'The reviewed selection is fulfilled; explicitly excluded items were not acquired.';
  else if (collection.status === 'reviewed') detail += 'The remaining included releases still need import review.';
  else if (collection.status === 'preparing') detail += 'Provider preparation must finish before the captured selection can be reviewed.';
  else if (collection.status === 'blocked') detail += 'Provider preparation is blocked and needs operator attention.';
  else detail += `${collection.pendingCount} captured items still need a decision. Finalize review after all decisions are saved.`;
  return { code: complete ? 'fulfilled' : 'under_review', label: complete ? 'Reviewed selection fulfilled' : 'Collection review',
    tone: complete ? 'selected' : 'held', detail, occurredAt: collection.reviewedAt ?? request.updatedAt ?? null };
}
