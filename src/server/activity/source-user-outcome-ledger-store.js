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
import { buildSourceUserUsernameKey } from './source-user-trust-service.js';

const MAX_LIST_LIMIT = 5000;
const DEFAULT_QUALITY_WEIGHT = 1;

/**
 * Clamps a delivered-quality weight into the [0, 1] unit interval. A non-finite
 * or missing value falls back to a clean full-quality success (1.0) so callers
 * and historical rows that never supply quality keep the prior binary
 * success/failure semantics.
 */
function normalizeQualityWeight(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_QUALITY_WEIGHT;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > 1) {
    return 1;
  }
  return parsed;
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function normalizeTimestamp(value, fallback) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? fallback : value.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
  }
  return fallback;
}

function mapOutcomeEventRow(row) {
  return {
    id: row.id,
    username: row.username,
    usernameKey: row.username_key,
    outcome: row.outcome,
    qualityWeight: row.quality_weight === null || row.quality_weight === undefined
      ? DEFAULT_QUALITY_WEIGHT
      : Number(row.quality_weight),
    qualityLabel: row.quality_label ?? null,
    eventType: row.event_type ?? null,
    reason: row.reason ?? null,
    actorUserId: row.actor_user_id ?? null,
    occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at,
    recordedAt: row.recorded_at instanceof Date ? row.recorded_at.toISOString() : row.recorded_at,
  };
}

/**
 * Append-only store for per-source-user delivery outcome events. Writes are
 * pure INSERTs, which are inherently free of read-modify-write lost-update
 * races (unlike the recovery_trust_snapshots full-table rewrite).
 */
export function createSourceUserOutcomeLedgerStore({ getPoolFn = getPool } = {}) {
  async function appendOutcomeEvent({
    actorUserId = null,
    eventType = null,
    occurredAt = null,
    outcome,
    qualityLabel = null,
    qualityWeight = DEFAULT_QUALITY_WEIGHT,
    reason = null,
    username,
  } = {}) {
    const normalizedUsername = normalizeOptionalString(username);
    const usernameKey = buildSourceUserUsernameKey(normalizedUsername);
    if (!normalizedUsername || !usernameKey || (outcome !== 'success' && outcome !== 'failure')) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const occurredAtIso = normalizeTimestamp(occurredAt, nowIso);

    const result = await getPoolFn().query(
      `
        INSERT INTO source_user_outcome_events (
          username_key,
          username,
          outcome,
          quality_weight,
          quality_label,
          event_type,
          reason,
          actor_user_id,
          occurred_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id,
          username_key,
          username,
          outcome,
          quality_weight,
          quality_label,
          event_type,
          reason,
          actor_user_id,
          occurred_at,
          recorded_at
      `,
      [
        usernameKey,
        normalizedUsername,
        outcome,
        normalizeQualityWeight(qualityWeight),
        normalizeOptionalString(qualityLabel),
        normalizeOptionalString(eventType),
        normalizeOptionalString(reason),
        actorUserId === null || actorUserId === undefined ? null : String(actorUserId),
        occurredAtIso,
      ],
    );

    const row = result.rows[0];
    return row ? mapOutcomeEventRow(row) : null;
  }

  async function listRecentOutcomeEvents({ usernameKeys = null, since = null, limit = MAX_LIST_LIMIT } = {}) {
    const normalizedKeys = Array.isArray(usernameKeys)
      ? Array.from(new Set(usernameKeys.map((value) => buildSourceUserUsernameKey(value)).filter(Boolean)))
      : null;

    if (Array.isArray(normalizedKeys) && normalizedKeys.length === 0) {
      return [];
    }

    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_LIST_LIMIT) : MAX_LIST_LIMIT;
    const conditions = [];
    const params = [];

    if (normalizedKeys) {
      params.push(normalizedKeys);
      conditions.push(`username_key = ANY($${params.length})`);
    }

    const sinceIso = since ? normalizeTimestamp(since, null) : null;
    if (sinceIso) {
      params.push(sinceIso);
      conditions.push(`occurred_at >= $${params.length}`);
    }

    params.push(safeLimit);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await getPoolFn().query(
      `
        SELECT
          id,
          username_key,
          username,
          outcome,
          quality_weight,
          quality_label,
          event_type,
          reason,
          actor_user_id,
          occurred_at,
          recorded_at
        FROM source_user_outcome_events
        ${whereClause}
        ORDER BY occurred_at DESC
        LIMIT $${params.length}
      `,
      params,
    );

    return result.rows.map(mapOutcomeEventRow);
  }

  async function pruneOutcomeEvents({ olderThan } = {}) {
    const olderThanIso = normalizeTimestamp(olderThan, null);
    if (!olderThanIso) {
      return { prunedCount: 0 };
    }

    const result = await getPoolFn().query(
      `
        DELETE FROM source_user_outcome_events
        WHERE occurred_at < $1
      `,
      [olderThanIso],
    );

    return { prunedCount: result.rowCount ?? 0 };
  }

  return {
    appendOutcomeEvent,
    listRecentOutcomeEvents,
    pruneOutcomeEvents,
  };
}
