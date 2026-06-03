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

const VALID_SOURCES = new Set(['manual', 'auto_suggested']);

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function toIso(value) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : value.toISOString();
  }
  return value ?? null;
}

function mapIgnoreEntryRow(row) {
  return {
    id: row.id,
    username: row.username,
    usernameKey: row.username_key,
    source: row.source,
    reason: row.reason ?? null,
    actorUserId: row.actor_user_id ?? null,
    suggestionSignals: row.suggestion_signals ?? null,
    lastAutoEvaluatedAt: toIso(row.last_auto_evaluated_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/**
 * Persistence for the operator-controlled source-user ignore list. Each row is
 * keyed by a UNIQUE username_key and upserted idempotently, so concurrent
 * writers cannot produce duplicates or lost updates.
 */
export function createSourceUserIgnoreStore({ getPoolFn = getPool } = {}) {
  async function listIgnoreEntries() {
    const result = await getPoolFn().query(
      `
        SELECT
          id,
          username_key,
          username,
          source,
          reason,
          actor_user_id,
          suggestion_signals,
          last_auto_evaluated_at,
          created_at,
          updated_at
        FROM source_user_ignore_entries
        ORDER BY created_at DESC
      `,
    );
    return result.rows.map(mapIgnoreEntryRow);
  }

  async function listIgnoredUsernames() {
    const result = await getPoolFn().query(
      'SELECT username FROM source_user_ignore_entries ORDER BY created_at DESC',
    );
    return result.rows.map((row) => row.username).filter((value) => typeof value === 'string' && value.length > 0);
  }

  async function getIgnoreEntry({ username } = {}) {
    const usernameKey = buildSourceUserUsernameKey(normalizeOptionalString(username));
    if (!usernameKey) {
      return null;
    }
    const result = await getPoolFn().query(
      `
        SELECT
          id,
          username_key,
          username,
          source,
          reason,
          actor_user_id,
          suggestion_signals,
          last_auto_evaluated_at,
          created_at,
          updated_at
        FROM source_user_ignore_entries
        WHERE username_key = $1
      `,
      [usernameKey],
    );
    const row = result.rows[0];
    return row ? mapIgnoreEntryRow(row) : null;
  }

  async function upsertIgnoreEntry({
    actorUserId = null,
    reason = null,
    source = 'manual',
    suggestionSignals = null,
    username,
  } = {}) {
    const normalizedUsername = normalizeOptionalString(username);
    const usernameKey = buildSourceUserUsernameKey(normalizedUsername);
    if (!normalizedUsername || !usernameKey) {
      return null;
    }

    const normalizedSource = VALID_SOURCES.has(source) ? source : 'manual';
    const signalsJson = suggestionSignals === null || suggestionSignals === undefined
      ? null
      : JSON.stringify(suggestionSignals);
    const lastAutoEvaluatedAt = normalizedSource === 'auto_suggested' ? new Date().toISOString() : null;

    const result = await getPoolFn().query(
      `
        INSERT INTO source_user_ignore_entries (
          username_key,
          username,
          source,
          reason,
          actor_user_id,
          suggestion_signals,
          last_auto_evaluated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        ON CONFLICT (username_key) DO UPDATE
        SET source = EXCLUDED.source,
            reason = EXCLUDED.reason,
            actor_user_id = EXCLUDED.actor_user_id,
            suggestion_signals = COALESCE(EXCLUDED.suggestion_signals, source_user_ignore_entries.suggestion_signals),
            last_auto_evaluated_at = COALESCE(EXCLUDED.last_auto_evaluated_at, source_user_ignore_entries.last_auto_evaluated_at),
            updated_at = NOW()
        RETURNING
          id,
          username_key,
          username,
          source,
          reason,
          actor_user_id,
          suggestion_signals,
          last_auto_evaluated_at,
          created_at,
          updated_at
      `,
      [
        usernameKey,
        normalizedUsername,
        normalizedSource,
        normalizeOptionalString(reason),
        actorUserId === null || actorUserId === undefined ? null : String(actorUserId),
        signalsJson,
        lastAutoEvaluatedAt,
      ],
    );

    const row = result.rows[0];
    return row ? mapIgnoreEntryRow(row) : null;
  }

  async function touchAutoEvaluation({ username } = {}) {
    const usernameKey = buildSourceUserUsernameKey(normalizeOptionalString(username));
    if (!usernameKey) {
      return false;
    }
    const result = await getPoolFn().query(
      `
        UPDATE source_user_ignore_entries
        SET last_auto_evaluated_at = NOW(),
            updated_at = NOW()
        WHERE username_key = $1
      `,
      [usernameKey],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async function removeIgnoreEntry({ username } = {}) {
    const usernameKey = buildSourceUserUsernameKey(normalizeOptionalString(username));
    if (!usernameKey) {
      return { removedCount: 0 };
    }
    const result = await getPoolFn().query(
      'DELETE FROM source_user_ignore_entries WHERE username_key = $1',
      [usernameKey],
    );
    return { removedCount: result.rowCount ?? 0 };
  }

  return {
    getIgnoreEntry,
    listIgnoreEntries,
    listIgnoredUsernames,
    removeIgnoreEntry,
    touchAutoEvaluation,
    upsertIgnoreEntry,
  };
}
