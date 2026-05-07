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

import { createActivityEventStore } from './activity-event-store.js';

const defaultLimit = 50;
const maxLimit = 200;
const allowedEventTypes = new Set([
  'request_created',
  'download_completed',
  'release_added',
  'artist_monitored',
  'request_fulfilled',
]);

/**
 * Clamps a limit value to [1, maxLimit], defaulting to `defaultLimit` when
 * the input is not a valid positive integer.
 * @param {number|null|undefined} limit
 * @returns {number}
 */
function resolveLimit(limit) {
  const n = Number.parseInt(String(limit ?? defaultLimit), 10);
  if (!Number.isFinite(n) || n < 1) return defaultLimit;
  return Math.min(n, maxLimit);
}

/**
 * Validates and normalizes an `eventType` filter.
 * Returns the type string if valid, or `null` to mean "no filter".
 * @param {string|null|undefined} eventType
 * @returns {string|null}
 */
function resolveEventTypeFilter(eventType) {
  if (typeof eventType !== 'string' || eventType.length === 0) return null;
  return allowedEventTypes.has(eventType) ? eventType : null;
}

/**
 * Business-logic service for household activity events.
 *
 * `recordActivityEvent` is a **fire-and-forget** helper — callers must NOT
 * await it in their critical path. It catches and logs all errors internally
 * so that recording failures never surface to the caller.
 *
 * `buildActivityFeed` is the read side, used by `GET /api/v1/activity/feed`.
 *
 * @param {object} [options]
 * @param {object} [options.activityEventStore]
 * @param {function} [options.getNow]
 * @param {object} [options.stderr] - Stream for error logging (injectable for tests).
 * @returns {{ recordActivityEvent, buildActivityFeed }}
 */
export function createActivityEventService({
  activityEventStore = createActivityEventStore(),
  getNow = () => new Date(),
  stderr = process.stderr,
} = {}) {
  /**
   * Records a single household activity event. Fire-and-forget: never throws.
   * Callers should invoke without `await` and `.catch()` is implicit.
   *
   * @param {object} params
   * @param {string} params.eventType
   * @param {string|null} [params.actorUserId]
   * @param {string|null} [params.entityType]
   * @param {string|null} [params.entityId]
   * @param {string|null} [params.entityTitle]
   * @param {string|null} [params.entityArtist]
   * @param {object|null} [params.extraPayload]
   * @returns {Promise<void>}
   */
  async function recordActivityEvent({
    eventType,
    actorUserId = null,
    entityType = null,
    entityId = null,
    entityTitle = null,
    entityArtist = null,
    extraPayload = null,
  }) {
    try {
      if (!allowedEventTypes.has(eventType)) {
        stderr.write(`[harmoniarr] activity event skipped: unknown eventType "${eventType}"\n`);
        return;
      }

      await activityEventStore.insertActivityEvent({
        eventType,
        actorUserId,
        entityType,
        entityId,
        entityTitle,
        entityArtist,
        extraPayload,
      });
    } catch (error) {
      stderr.write(`[harmoniarr] activity event recording failed (${eventType}): ${error?.message ?? error}\n`);
    }
  }

  /**
   * Builds the household activity feed payload for `GET /api/v1/activity/feed`.
   * Returns the full stream — no per-user server-side filtering. Scope
   * (full-page vs top-10 panel) is controlled at the client rendering layer.
   *
   * @param {object} [options]
   * @param {number} [options.limit]
   * @param {string|null} [options.eventType] - Optional event-type filter.
   * @param {string|null} [options.actorUserId] - Optional per-user filter.
   * @returns {Promise<{ checkedAt: string, events: object[], total: number }>}
   */
  async function buildActivityFeed({
    limit = defaultLimit,
    eventType = null,
    actorUserId = null,
  } = {}) {
    const resolvedLimit = resolveLimit(limit);
    const resolvedEventType = resolveEventTypeFilter(eventType);

    const events = await activityEventStore.listActivityEvents({
      limit: resolvedLimit,
      eventType: resolvedEventType,
      actorUserId: typeof actorUserId === 'string' && actorUserId.length > 0 ? actorUserId : null,
    });

    return {
      checkedAt: getNow().toISOString(),
      events,
      total: events.length,
    };
  }

  return {
    buildActivityFeed,
    recordActivityEvent,
  };
}
