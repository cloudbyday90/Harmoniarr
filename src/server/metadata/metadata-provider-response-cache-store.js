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

function normalizeRequiredText(value, label) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`metadata provider response cache ${label} is required`);
  }

  return normalized;
}

function normalizeFetchedAt(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('metadata provider response cache fetchedAt must be a valid date');
  }

  return date.toISOString();
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('metadata provider response cache payload must be an object');
  }

  return payload;
}

function mapCacheRow(row) {
  return {
    cacheKey: row.cache_key,
    cacheNamespace: row.cache_namespace,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    fetchedAt: row.fetched_at instanceof Date ? row.fetched_at.toISOString() : row.fetched_at,
    id: row.id,
    payload: row.payload,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

/**
 * Persistence boundary for the current normalized provider response cache.
 * Freshness decisions deliberately belong to the cache policy/service layer.
 */
export function createMetadataProviderResponseCacheStore({ getPoolFn = getPool } = {}) {
  async function getCacheEntry({ cacheNamespace, cacheKey }) {
    const normalizedNamespace = normalizeRequiredText(cacheNamespace, 'cacheNamespace');
    const normalizedKey = normalizeRequiredText(cacheKey, 'cacheKey');
    const pool = getPoolFn();
    const result = await pool.query(
      `SELECT id, cache_namespace, cache_key, payload, fetched_at, created_at, updated_at
         FROM metadata_provider_response_cache
        WHERE cache_namespace = $1
          AND cache_key = $2`,
      [normalizedNamespace, normalizedKey],
    );

    return result.rows[0] ? mapCacheRow(result.rows[0]) : null;
  }

  async function upsertCacheEntry({ cacheNamespace, cacheKey, payload, fetchedAt }) {
    const normalizedNamespace = normalizeRequiredText(cacheNamespace, 'cacheNamespace');
    const normalizedKey = normalizeRequiredText(cacheKey, 'cacheKey');
    const normalizedPayload = normalizePayload(payload);
    const normalizedFetchedAt = normalizeFetchedAt(fetchedAt);
    const pool = getPoolFn();
    const result = await pool.query(
      `INSERT INTO metadata_provider_response_cache (
         cache_namespace,
         cache_key,
         payload,
         fetched_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (cache_namespace, cache_key)
       DO UPDATE SET
         payload = EXCLUDED.payload,
         fetched_at = EXCLUDED.fetched_at,
         updated_at = NOW()
       RETURNING id, cache_namespace, cache_key, payload, fetched_at, created_at, updated_at`,
      [normalizedNamespace, normalizedKey, JSON.stringify(normalizedPayload), normalizedFetchedAt],
    );

    return mapCacheRow(result.rows[0]);
  }

  async function pruneCacheEntries({ olderThan }) {
    const cutoff = normalizeFetchedAt(olderThan);
    const pool = getPoolFn();
    const result = await pool.query(
      'DELETE FROM metadata_provider_response_cache WHERE fetched_at < $1',
      [cutoff],
    );

    return result.rowCount ?? 0;
  }

  return {
    getCacheEntry,
    pruneCacheEntries,
    upsertCacheEntry,
  };
}
