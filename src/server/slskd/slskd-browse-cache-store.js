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

/**
 * Maps a raw DB row from `slskd_browse_cache` to a normalized camelCase shape.
 * @param {object} row
 * @returns {object}
 */
function mapBrowseCacheRow(row) {
  return {
    id: row.id,
    username: row.username,
    directory: row.directory,
    fileCount: row.file_count ?? 0,
    payload: row.payload ?? null,
    observedAt: row.observed_at instanceof Date
      ? row.observed_at.toISOString()
      : row.observed_at,
  };
}

function normalizeKey(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * SQL store for `slskd_browse_cache`.
 *
 * Caches slskd per-folder browse responses keyed by `(username, directory)`.
 * All freshness/TTL decisions are made by callers; this store only persists and
 * reads rows, with an explicit `freshAfter` cutoff used by the read path.
 *
 * @param {object} [options]
 * @param {function} [options.getPoolFn] Pool accessor (injectable for testing).
 * @returns {{ getFreshBrowse, upsertBrowse, pruneExpiredBrowse }}
 */
export function createSlskdBrowseCacheStore({ getPoolFn = getPool } = {}) {
  /**
   * Returns a cached browse row for a folder only when it is at least as recent
   * as `freshAfter`. Stale or missing rows resolve to `null` so callers re-browse.
   *
   * @param {object} params
   * @param {string} params.username
   * @param {string} params.directory
   * @param {Date|string} params.freshAfter Cutoff timestamp; rows older are ignored.
   * @returns {Promise<object|null>}
   */
  async function getFreshBrowse({ username, directory, freshAfter }) {
    const normalizedUsername = normalizeKey(username);
    const normalizedDirectory = normalizeKey(directory);
    if (!normalizedUsername || !normalizedDirectory || freshAfter == null) {
      return null;
    }

    const cutoff = freshAfter instanceof Date ? freshAfter.toISOString() : freshAfter;
    const pool = getPoolFn();
    const result = await pool.query(
      `SELECT id, username, directory, file_count, payload, observed_at
         FROM slskd_browse_cache
        WHERE username = $1
          AND directory = $2
          AND observed_at >= $3`,
      [normalizedUsername, normalizedDirectory, cutoff],
    );

    return result.rows[0] ? mapBrowseCacheRow(result.rows[0]) : null;
  }

  /**
   * Inserts or refreshes a cached browse row for a folder, stamping `observed_at`.
   *
   * @param {object} params
   * @param {string} params.username
   * @param {string} params.directory
   * @param {number} params.fileCount
   * @param {object} params.payload Normalized browse payload to cache.
   * @returns {Promise<object>} The upserted row, normalized.
   */
  async function upsertBrowse({ username, directory, fileCount, payload }) {
    const normalizedUsername = normalizeKey(username);
    const normalizedDirectory = normalizeKey(directory);
    if (!normalizedUsername || !normalizedDirectory) {
      throw new Error('slskd browse cache upsert requires a username and directory');
    }

    const normalizedFileCount = Number.isInteger(fileCount) && fileCount >= 0 ? fileCount : 0;
    const pool = getPoolFn();
    const result = await pool.query(
      `INSERT INTO slskd_browse_cache (username, directory, file_count, payload, observed_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (username, directory)
       DO UPDATE SET
         file_count  = EXCLUDED.file_count,
         payload     = EXCLUDED.payload,
         observed_at = NOW(),
         updated_at  = NOW()
       RETURNING id, username, directory, file_count, payload, observed_at`,
      [normalizedUsername, normalizedDirectory, normalizedFileCount, JSON.stringify(payload ?? null)],
    );

    return mapBrowseCacheRow(result.rows[0]);
  }

  /**
   * Deletes cached browse rows older than `olderThan` (retention cleanup).
   *
   * @param {object} params
   * @param {Date|string} params.olderThan
   * @returns {Promise<number>} Number of rows removed.
   */
  async function pruneExpiredBrowse({ olderThan }) {
    if (olderThan == null) {
      return 0;
    }

    const cutoff = olderThan instanceof Date ? olderThan.toISOString() : olderThan;
    const pool = getPoolFn();
    const result = await pool.query(
      'DELETE FROM slskd_browse_cache WHERE observed_at < $1',
      [cutoff],
    );

    return result.rowCount ?? 0;
  }

  return {
    getFreshBrowse,
    upsertBrowse,
    pruneExpiredBrowse,
  };
}
