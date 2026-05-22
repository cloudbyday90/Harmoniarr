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

import {
  highValuePlexEvents,
  normalizePlexWebhookPayload,
} from '../../../shared/fulfillment-evidence-contract.js';

export function createPlexWebhookIngestionService({
  fulfillmentEvidenceService,
  plexOwnerLinkService,
}) {
  async function ingestWebhook({ rawPayload }) {
    const linkStatus = await plexOwnerLinkService.buildStatus();
    if (!linkStatus.linked) {
      return { accepted: false, reason: 'plex_not_linked' };
    }

    const normalized = normalizePlexWebhookPayload(rawPayload);
    if (!normalized) {
      return { accepted: false, reason: 'invalid_payload' };
    }

    if (!highValuePlexEvents.has(normalized.event)) {
      return { accepted: false, reason: 'event_not_high_value' };
    }

    const evidence = await fulfillmentEvidenceService.recordEvidence({
      normalizedPayload: normalized,
    });

    const correlation = await fulfillmentEvidenceService.correlateEvidence({
      evidence,
    });

    return {
      accepted: true,
      correlationKey: evidence.correlationKey,
      evidenceId: evidence.id,
      matched: correlation.matched,
    };
  }

  async function getWebhookStatus() {
    const linkStatus = await plexOwnerLinkService.buildStatus();
    const evidenceSummary = await fulfillmentEvidenceService.getEvidenceSummary();

    return {
      linked: linkStatus.linked,
      linkedUserTitle: linkStatus.linkedUserTitle ?? null,
      recentEvidence: evidenceSummary,
      webhookEnabled: linkStatus.linked,
    };
  }

  return {
    getWebhookStatus,
    ingestWebhook,
  };
}
