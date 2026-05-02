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

import { getPool } from './database.js';
import {
  decodeTimelineCursor,
  normalizeTimelinePageLimit,
  resolveTimelineCursorOccurredAt,
} from './timeline-pagination.js';

function toAuditEvent(row) {
  return {
    details: row.details ?? {},
    entityId: row.entity_id,
    entityType: row.entity_type,
    eventType: row.event_type,
    id: row.id,
    occurredAt: row.occurred_at,
    summary: row.summary,
  };
}

function buildAuditWhereClause({ actorUserId = null, entityId = null, entityType = null } = {}) {
  const whereClauses = [];
  const values = [];

  if (actorUserId) {
    values.push(actorUserId);
    whereClauses.push(`actor_user_id = $${values.length}`);
  }

  if (entityType) {
    values.push(entityType);
    whereClauses.push(`entity_type = $${values.length}`);
  }

  if (entityId) {
    values.push(entityId);
    whereClauses.push(`entity_id = $${values.length}`);
  }

  return {
    values,
    whereClause: whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '',
  };
}

export function createAuditReadService({
  getPoolFn = getPool,
} = {}) {
  async function listRecentAuditEvents({ actorUserId = null, before = null, limit = 10 } = {}) {
    const normalizedLimit = normalizeTimelinePageLimit(limit, { defaultLimit: 10, maxLimit: 25 });
    const { values, whereClause } = buildAuditWhereClause({ actorUserId });
    const whereClauses = whereClause ? [whereClause.replace(/^WHERE /, '')] : [];
    const beforeCursor = decodeTimelineCursor(before);

    if (beforeCursor) {
      values.push(resolveTimelineCursorOccurredAt(beforeCursor));
      whereClauses.push(`occurred_at < $${values.length}::timestamptz`);
    }

    values.push(normalizedLimit);

    const result = await getPoolFn().query(
      `
        SELECT
          id,
          occurred_at,
          event_type,
          entity_type,
          entity_id,
          summary,
          details
        FROM audit_events
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
        ORDER BY occurred_at DESC, id DESC
        LIMIT $${values.length}
      `,
      values,
    );

    return result.rows.map(toAuditEvent);
  }

  async function listAuditEventsForEntity({ entityId, entityType, limit = 10 } = {}) {
    const normalizedLimit = normalizeTimelinePageLimit(limit, { defaultLimit: 10, maxLimit: 25 });
    const { values, whereClause } = buildAuditWhereClause({ entityId, entityType });

    values.push(normalizedLimit);

    const result = await getPoolFn().query(
      `
        SELECT
          id,
          occurred_at,
          event_type,
          entity_type,
          entity_id,
          summary,
          details
        FROM audit_events
        ${whereClause}
        ORDER BY occurred_at DESC, id DESC
        LIMIT $${values.length}
      `,
      values,
    );

    return result.rows.map(toAuditEvent);
  }

  return {
    listAuditEventsForEntity,
    listRecentAuditEvents,
  };
}