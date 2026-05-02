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

function createValidationError(message) {
  const error = new Error(message);
  error.code = 'validation_error';
  error.status = 400;
  return error;
}

export function normalizeTimelinePageLimit(limit, { defaultLimit = 10, maxLimit = 25 } = {}) {
  const parsed = Number.parseInt(limit, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultLimit;
  }

  return Math.min(parsed, maxLimit);
}

export function encodeTimelineCursor(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeTimelineCursor(cursor, { fieldName = 'before' } = {}) {
  if (cursor == null || cursor === '') {
    return null;
  }

  if (typeof cursor !== 'string') {
    throw createValidationError(`${fieldName} must be a valid cursor`);
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new Error('invalid');
    }

    return decoded;
  } catch {
    throw createValidationError(`${fieldName} must be a valid cursor`);
  }
}

export function resolveTimelineCursorOccurredAt(cursor, { fieldName = 'before' } = {}) {
  if (typeof cursor?.occurredAt !== 'string' || Number.isNaN(new Date(cursor.occurredAt).getTime())) {
    throw createValidationError(`${fieldName} must include a valid occurredAt value`);
  }

  return cursor.occurredAt;
}

export function resolveTimelineCursorId(cursor, { fieldName = 'before' } = {}) {
  if (typeof cursor?.id !== 'string' || cursor.id.trim().length < 1) {
    throw createValidationError(`${fieldName} must include a valid id value`);
  }

  return cursor.id.trim();
}

function toSortableTime(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function compareTimelineEntriesDesc(left, right) {
  const timestampDelta = toSortableTime(right?.occurredAt) - toSortableTime(left?.occurredAt);
  if (timestampDelta !== 0) {
    return timestampDelta;
  }

  return String(right?.id ?? '').localeCompare(String(left?.id ?? ''));
}

export function buildTimelinePage({
  cursorPayload = (entry) => ({ occurredAt: entry.occurredAt }),
  entries,
  limit,
} = {}) {
  const normalizedLimit = normalizeTimelinePageLimit(limit);
  const hasMore = entries.length > normalizedLimit;
  const pageEntries = entries.slice(0, normalizedLimit);

  return {
    entries: pageEntries,
    pageInfo: {
      hasMore,
      nextCursor: hasMore && pageEntries.length > 0
        ? encodeTimelineCursor(cursorPayload(pageEntries.at(-1)))
        : null,
    },
  };
}