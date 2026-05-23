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
import { normalizeTimelinePageLimit } from './timeline-pagination.js';

function encodeAuditCursor({ occurredAt, id }) {
  return Buffer.from(JSON.stringify({ o: occurredAt, i: id })).toString('base64url');
}

function decodeAuditCursor(cursor) {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!parsed.o || !parsed.i) return null;
    return { occurredAt: parsed.o, id: parsed.i };
  } catch {
    return null;
  }
}

export function createAppUserDetailService({
  getPoolFn = getPool,
} = {}) {
  async function getUserRequestSummary({ userId }) {
    const [byUserResult, asTargetResult] = await Promise.all([
      getPoolFn().query(
        `
          SELECT
            request_state,
            COUNT(*)::int AS count
          FROM media_requests
          WHERE requested_by_user_id = $1
          GROUP BY request_state
        `,
        [userId],
      ),
      getPoolFn().query(
        `
          SELECT
            request_state,
            COUNT(*)::int AS count
          FROM media_requests
          WHERE requested_for_user_id = $1
          GROUP BY request_state
        `,
        [userId],
      ),
    ]);

    function toCounts(rows) {
      const counts = {};
      for (const row of rows) {
        counts[row.request_state] = row.count;
      }
      return {
        cancelled: counts['cancelled'] ?? 0,
        failed: counts['failed'] ?? 0,
        needsFetch: counts['needs_fetch'] ?? 0,
        needsReview: counts['needs_review'] ?? 0,
      };
    }

    const asRequester = toCounts(byUserResult.rows);
    const asTarget = toCounts(asTargetResult.rows);
    const total = byUserResult.rows.reduce((sum, r) => sum + r.count, 0) + asTargetResult.rows.reduce((sum, r) => sum + r.count, 0);

    return { asRequester, asTarget, total };
  }

  async function getUserSessions({ userId }) {
    const result = await getPoolFn().query(
      `
        SELECT
          id,
          issued_at,
          issued_ip,
          issued_user_agent,
          last_used_at,
          expires_at,
          is_revoked
        FROM refresh_tokens
        WHERE app_user_id = $1
        ORDER BY issued_at DESC
        LIMIT 50
      `,
      [userId],
    );

    return result.rows.map((row) => ({
      expiresAt: row.expires_at,
      id: row.id,
      issuedAt: row.issued_at,
      issuedIp: row.issued_ip ?? null,
      issuedUserAgent: row.issued_user_agent ?? null,
      isRevoked: row.is_revoked,
      lastUsedAt: row.last_used_at ?? null,
    }));
  }

  async function listUserAuditEvents({ userId, cursor = null, limit = 25 } = {}) {
    const normalizedLimit = normalizeTimelinePageLimit(limit, { defaultLimit: 25, maxLimit: 100 });
    const fetchLimit = normalizedLimit + 1;
    const values = [userId];
    const whereClauses = ['actor_user_id = $1'];

    const decoded = cursor ? decodeAuditCursor(cursor) : null;
    if (decoded) {
      values.push(decoded.occurredAt, decoded.id);
      whereClauses.push(`(occurred_at, id) < ($${values.length - 1}::timestamptz, $${values.length})`);
    }

    values.push(fetchLimit);

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
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY occurred_at DESC, id DESC
        LIMIT $${values.length}
      `,
      values,
    );

    const hasMore = result.rows.length > normalizedLimit;
    const rows = hasMore ? result.rows.slice(0, normalizedLimit) : result.rows;
    const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;

    return {
      events: rows.map((row) => ({
        details: row.details ?? null,
        entityId: row.entity_id ?? null,
        entityType: row.entity_type ?? null,
        eventType: row.event_type,
        id: row.id,
        occurredAt: row.occurred_at,
        summary: row.summary,
      })),
      hasMore,
      nextCursor: hasMore && lastRow
        ? encodeAuditCursor({ occurredAt: lastRow.occurred_at, id: lastRow.id })
        : null,
    };
  }

  return {
    getUserRequestSummary,
    getUserSessions,
    listUserAuditEvents,
  };
}
