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

import { createApiError } from '../../auth.js';

const MAX_EVENT_ID_LENGTH = 200;
const MAX_EVENT_TYPE_LENGTH = 100;
const MAX_VERSION_LENGTH = 50;
export const DEFAULT_MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

// Soulseek/slskd event type names that should nudge download reconciliation.
const actionableEventTypes = new Map([
  ['downloadfilecomplete', 'download_file_complete'],
  ['downloaddirectorycomplete', 'download_directory_complete'],
]);

function readField(payload, ...keys) {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

function normalizeSafeToken(value, { fieldName, maxLength }) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'slskd_webhook_invalid_payload', `${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw createApiError(400, 'slskd_webhook_invalid_payload', `${fieldName} is required`);
  }
  if (trimmed.length > maxLength) {
    throw createApiError(400, 'slskd_webhook_invalid_payload', `${fieldName} exceeds the maximum supported length`);
  }
  if (CONTROL_CHARACTER_PATTERN.test(trimmed)) {
    throw createApiError(400, 'slskd_webhook_invalid_payload', `${fieldName} contains unsupported control characters`);
  }
  return trimmed;
}

function normalizeOptionalToken(value, { maxLength }) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || CONTROL_CHARACTER_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Parses and validates a raw slskd webhook payload into a minimal, trusted
 * descriptor. Only the event identity (for deduplication) and the event type
 * (for routing) are retained — Soulseek-controlled values such as remote
 * filenames and usernames are deliberately NOT propagated, since reconciliation
 * re-reads authoritative transfer state from slskd rather than trusting the
 * webhook body.
 *
 * Pure and side-effect free. Throws createApiError(400) for structurally invalid
 * payloads. Unknown or stale events are returned with `actionable: false` so the
 * caller can acknowledge them (avoiding webhook retry storms) without acting.
 */
export function parseSlskdWebhookEvent(rawPayload, {
  now = new Date(),
  maxClockSkewMs = DEFAULT_MAX_CLOCK_SKEW_MS,
} = {}) {
  if (rawPayload === null || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw createApiError(400, 'slskd_webhook_invalid_payload', 'Webhook payload must be a JSON object');
  }

  const id = normalizeSafeToken(readField(rawPayload, 'id', 'Id'), {
    fieldName: 'id',
    maxLength: MAX_EVENT_ID_LENGTH,
  });
  const rawType = normalizeSafeToken(readField(rawPayload, 'type', 'Type'), {
    fieldName: 'type',
    maxLength: MAX_EVENT_TYPE_LENGTH,
  });
  const version = normalizeOptionalToken(readField(rawPayload, 'version', 'Version'), {
    maxLength: MAX_VERSION_LENGTH,
  });
  const rawTimestamp = normalizeOptionalToken(readField(rawPayload, 'timestamp', 'Timestamp'), {
    maxLength: 64,
  });

  const eventType = actionableEventTypes.get(rawType.toLowerCase()) ?? null;
  if (!eventType) {
    return {
      actionable: false,
      eventType: rawType.toLowerCase(),
      id,
      reason: 'unsupported_event_type',
      timestamp: rawTimestamp,
      version,
    };
  }

  let timestamp = rawTimestamp;
  if (rawTimestamp) {
    const parsedTime = Date.parse(rawTimestamp);
    if (Number.isNaN(parsedTime)) {
      timestamp = null;
    } else {
      timestamp = new Date(parsedTime).toISOString();
      const skewMs = Math.abs(now.getTime() - parsedTime);
      if (skewMs > maxClockSkewMs) {
        return {
          actionable: false,
          eventType,
          id,
          reason: 'stale_event',
          timestamp,
          version,
        };
      }
    }
  }

  return {
    actionable: true,
    eventType,
    id,
    reason: null,
    timestamp,
    version,
  };
}
