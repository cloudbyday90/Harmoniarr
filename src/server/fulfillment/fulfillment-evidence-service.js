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

import { createFulfillmentEvidenceStore } from './fulfillment-evidence-store.js';

const defaultRetentionDays = 30;
const correlationLookbackDays = 7;

export function createFulfillmentEvidenceService({
  fulfillmentEvidenceStore = createFulfillmentEvidenceStore(),
  getNow = () => new Date(),
} = {}) {
  async function recordEvidence({ normalizedPayload }) {
    const now = getNow();
    const expiresAt = new Date(now.getTime() + defaultRetentionDays * 24 * 60 * 60 * 1000);

    return fulfillmentEvidenceStore.insertFulfillmentEvidence({
      correlationKey: normalizedPayload.correlationKey,
      expiresAt: expiresAt.toISOString(),
      metadataAlbum: normalizedPayload.metadata.album,
      metadataArtist: normalizedPayload.metadata.artist,
      metadataTitle: normalizedPayload.metadata.title,
      metadataType: normalizedPayload.metadata.type,
      rawPayload: normalizedPayload.rawPayload,
      sourceEvent: normalizedPayload.event,
      sourceServerUuid: normalizedPayload.server.uuid,
      sourceType: 'plex_webhook',
    });
  }

  async function correlateEvidence({ evidence }) {
    const now = getNow();
    const lookbackDate = new Date(now.getTime() - correlationLookbackDays * 24 * 60 * 60 * 1000);

    const match = await fulfillmentEvidenceStore.findMatchingReleaseEvent({
      correlationKey: evidence.correlationKey,
      receivedAfter: lookbackDate.toISOString(),
    });

    if (!match) {
      return { matched: false };
    }

    const updated = await fulfillmentEvidenceStore.markEvidenceMatched({
      activityEventId: match.entityId,
      evidenceId: evidence.id,
      matchedAt: now.toISOString(),
    });

    return { match, matched: true, updated };
  }

  async function correlateUnmatchedEvidence({ limit = 100 } = {}) {
    const unmatched = await fulfillmentEvidenceStore.listUnmatchedEvidence({ limit });
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const evidence of unmatched) {
      const result = await correlateEvidence({ evidence });
      if (result.matched) {
        matchedCount++;
      } else {
        unmatchedCount++;
      }
    }

    return { matched: matchedCount, total: unmatched.length, unmatched: unmatchedCount };
  }

  async function deleteExpiredEvidence() {
    return fulfillmentEvidenceStore.deleteExpiredEvidence();
  }

  async function getEvidenceSummary() {
    return fulfillmentEvidenceStore.getEvidenceSummary();
  }

  async function listEvidenceForActivityEvent({ activityEventId }) {
    return fulfillmentEvidenceStore.listEvidenceForActivityEvent({ activityEventId });
  }

  return {
    correlateEvidence,
    correlateUnmatchedEvidence,
    deleteExpiredEvidence,
    getEvidenceSummary,
    listEvidenceForActivityEvent,
    recordEvidence,
  };
}
