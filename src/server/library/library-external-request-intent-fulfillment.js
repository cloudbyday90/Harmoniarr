/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { normalizeExternalMediaSource } from './external-media-source-parser.js';

export function buildExternalRequestIntentFulfillmentStatus({ request, intents, candidates }) {
  if (request.requestKind !== 'external_url' || request.requestState !== 'needs_fetch' || intents.length === 0) return null;
  const targetIntents = intents.filter((intent) => intent.requestedForUserId === request.requestedForUser?.id);
  if (targetIntents.length === 0) return null;
  const appliedIds = new Set(candidates.filter((candidate) => candidate.status === 'applied')
    .map((candidate) => candidate.normalizedPayload?.requestOwnership?.externalRequestReleaseIntentId));
  const importedCount = targetIntents.filter((intent) => appliedIds.has(intent.id)).length;
  if (!candidates.some((candidate) => candidate.status === 'applied')) return null;
  let singleRelease = false;
  try {
    singleRelease = normalizeExternalMediaSource(request.sourceUrl).resourceType === 'release';
  } catch { /* An unknown source cannot establish collection completeness. */ }
  // Container expansion has no durable inclusion/exclusion completion contract yet.
  // Importing approved leaves must not claim that an entire collection is fulfilled.
  if (singleRelease && importedCount === targetIntents.length) return null;
  return {
    code: 'under_review', label: 'Approved album progress', tone: 'held',
    detail: `${importedCount} of ${targetIntents.length} approved albums imported for this target. ${singleRelease ? 'Other approved albums still need import review.' : 'Collection completion still needs review; importing approved albums does not complete the entire collection.'}`,
    occurredAt: request.updatedAt ?? null,
  };
}
