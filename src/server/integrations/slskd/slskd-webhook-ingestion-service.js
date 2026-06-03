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

import { timingSafeEqual } from 'node:crypto';
import { createApiError } from '../../auth.js';
import {
  DEFAULT_MAX_CLOCK_SKEW_MS,
  parseSlskdWebhookEvent,
} from './slskd-webhook-event.js';

const WEBHOOK_OPERATION_SCOPE = 'slskd_webhook_event';

/**
 * Constant-time comparison of two secrets. Returns false for any mismatch,
 * including differing lengths, without leaking timing information about how much
 * of the secret matched.
 */
function secretsMatch(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) {
    // Still perform a comparison against a same-length buffer to keep timing
    // independent of length, then return false.
    timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function createSlskdWebhookIngestionService({
  executeIdempotentMutation = null,
  getNow = () => new Date(),
  getWebhookSecret = () => null,
  maxClockSkewMs = DEFAULT_MAX_CLOCK_SKEW_MS,
  nudgeReconciliationFn = async () => {},
  parseEventFn = parseSlskdWebhookEvent,
} = {}) {
  function resolveConfiguredSecret() {
    const secret = getWebhookSecret();
    if (typeof secret !== 'string' || secret.trim().length === 0) {
      return null;
    }
    return secret;
  }

  function verifyWebhookSecret(providedSecret) {
    const configuredSecret = resolveConfiguredSecret();
    if (!configuredSecret) {
      // The endpoint is disabled until an operator configures a shared secret.
      throw createApiError(503, 'slskd_webhook_not_configured', 'slskd webhook ingestion is not configured');
    }
    if (!secretsMatch(providedSecret, configuredSecret)) {
      throw createApiError(401, 'slskd_webhook_unauthorized', 'Invalid slskd webhook credentials');
    }
  }

  function triggerNudge(event) {
    // Reconciliation re-reads authoritative slskd transfer state; failures here
    // must never propagate to the webhook response or block acknowledgement.
    void Promise.resolve()
      .then(() => nudgeReconciliationFn({ eventType: event.eventType }))
      .catch(() => {});
  }

  async function ingestWebhookEvent({ providedSecret, rawPayload }) {
    verifyWebhookSecret(providedSecret);

    const event = parseEventFn(rawPayload, {
      maxClockSkewMs,
      now: getNow(),
    });

    const runMutation = async () => {
      if (event.actionable) {
        triggerNudge(event);
      }
      return {
        body: {
          accepted: true,
          actionable: event.actionable,
          eventType: event.eventType,
          reason: event.reason,
        },
        statusCode: 202,
      };
    };

    if (typeof executeIdempotentMutation !== 'function') {
      const result = await runMutation();
      return { ...result.body, deduplicated: false };
    }

    const outcome = await executeIdempotentMutation({
      actorUserId: null,
      executeMutation: runMutation,
      idempotencyKey: event.id,
      operationScope: WEBHOOK_OPERATION_SCOPE,
      requestPayload: {
        eventType: event.eventType,
        id: event.id,
        version: event.version,
      },
    });

    return {
      ...(outcome.body ?? {}),
      deduplicated: Boolean(outcome.replayed),
    };
  }

  return {
    ingestWebhookEvent,
  };
}
