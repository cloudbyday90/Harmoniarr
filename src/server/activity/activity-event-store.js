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

import { getPool } from '../database.js';

const defaultLimit = 50;
const maxLimit = 200;

/**
 * Maps a raw DB row from `activity_events` to a normalized camelCase shape.
 * @param {object} row
 * @returns {object}
 */
function mapActivityEventRow(row) {
  return {
    id: row.id,
    eventType: row.event_type,
    actorUserId: row.actor_user_id ?? null,
    entityType: row.entity_type ?? null,
    entityId: row.entity_id ?? null,
    entityTitle: row.entity_title ?? null,
    entityArtist: row.entity_artist ?? null,
    extraPayload: row.extra_payload ?? null,
    occurredAt: row.occurred_at instanceof Date
      ? row.occurred_at.toISOString()
      : row.occurred_at,
  };
}

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
 * SQL store for `activity_events`. Handles raw INSERT and SELECT operations.
 * All business logic lives in `activity-event-service.js`.
 *
 * @param {object} [options]
 * @param {function} [options.getPoolFn] - Pool accessor (injectable for testing).
 * @returns {{ insertActivityEvent, listActivityEvents }}
 */
export function createActivityEventStore({ getPoolFn = getPool } = {}) {
  /**
   * Inserts a single activity event row.
   *
   * @param {object} params
   * @param {string} params.eventType - One of the allowed event_type CHECK values.
   * @param {string|null} [params.actorUserId]
   * @param {string|null} [params.entityType]
   * @param {string|null} [params.entityId]
   * @param {string|null} [params.entityTitle]
   * @param {string|null} [params.entityArtist]
   * @param {object|null} [params.extraPayload]
   * @returns {Promise<object>} The inserted row, normalized.
   */
  async function insertActivityEvent({
    eventType,
    actorUserId = null,
    entityType = null,
    entityId = null,
    entityTitle = null,
    entityArtist = null,
    extraPayload = null,
  }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `INSERT INTO activity_events
         (event_type, actor_user_id, entity_type, entity_id, entity_title, entity_artist, extra_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        eventType,
        actorUserId,
        entityType,
        entityId,
        entityTitle,
        entityArtist,
        extraPayload !== null ? JSON.stringify(extraPayload) : null,
      ],
    );
    return mapActivityEventRow(result.rows[0]);
  }

  /**
   * Lists activity events ordered by `occurred_at DESC`.
   *
   * Optional filters: `eventType` and `actorUserId` add WHERE clauses. When
   * both are provided they are combined with AND. No cross-table JOINs — all
   * display fields are denormalized on insert.
   *
   * @param {object} [params]
   * @param {number} [params.limit]
   * @param {string|null} [params.eventType]
   * @param {string|null} [params.actorUserId]
   * @returns {Promise<object[]>}
   */
  async function listActivityEvents({
    limit = defaultLimit,
    eventType = null,
    actorUserId = null,
  } = {}) {
    const resolvedLimit = resolveLimit(limit);
    const pool = getPoolFn();

    const conditions = [];
    const values = [];

    if (typeof eventType === 'string' && eventType.length > 0) {
      values.push(eventType);
      conditions.push(`event_type = $${values.length}`);
    }

    if (typeof actorUserId === 'string' && actorUserId.length > 0) {
      values.push(actorUserId);
      conditions.push(`actor_user_id = $${values.length}`);
    }

    values.push(resolvedLimit);
    const limitParam = `$${values.length}`;

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await pool.query(
      `SELECT * FROM activity_events
       ${whereClause}
       ORDER BY occurred_at DESC
       LIMIT ${limitParam}`,
      values,
    );

    return result.rows.map(mapActivityEventRow);
  }

  /**
   * Deletes activity events older than the given cutoff date in batches.
   * Returns the number of rows deleted.
   *
   * @param {object} params
   * @param {Date} params.cutoffDate
   * @param {number} [params.batchSize]
   * @returns {Promise<number>}
   */
  async function deleteExpiredActivityEvents({ cutoffDate, batchSize = 1000 }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `DELETE FROM activity_events
       WHERE id IN (
         SELECT id FROM activity_events
         WHERE occurred_at < $1
         ORDER BY occurred_at ASC
         LIMIT $2
       )`,
      [cutoffDate, batchSize],
    );
    return result.rowCount ?? 0;
  }

  return {
    deleteExpiredActivityEvents,
    insertActivityEvent,
    listActivityEvents,
  };
}
