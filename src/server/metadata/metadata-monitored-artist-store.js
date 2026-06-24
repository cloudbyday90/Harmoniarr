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

const DEFAULT_MONITORED_RELEASE_GROUP_TYPES = ['album', 'ep'];

/**
 * Allow-list of admin sort keys to safe, code-owned SQL order expressions.
 * User-supplied sort values are never interpolated directly; they select an
 * entry from this map (OWASP guidance for non-bindable SQL parts).
 */
const ADMIN_MONITORED_SORT_COLUMNS = new Map([
  ['name', 'metadata_artists.name ASC'],
  ['name_desc', 'metadata_artists.name DESC'],
  ['monitored_at', 'operator_scope.monitored_at DESC'],
  ['monitored_at_asc', 'operator_scope.monitored_at ASC'],
  ['last_refreshed', 'metadata_artist_refresh_state.last_refreshed_at DESC NULLS LAST'],
  ['country', 'metadata_artists.country ASC NULLS LAST'],
]);

function normalizeDate(value) {
  return value?.toISOString?.() ?? value ?? null;
}

function normalizeLimit(limit) {
  const parsed = Number(limit);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 25;
}

function normalizeOffset(offset) {
  const parsed = Number(offset);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeReleaseGroupTypes(value) {
  return Array.isArray(value) && value.length > 0 ? value : DEFAULT_MONITORED_RELEASE_GROUP_TYPES;
}

function mapAdminMonitoredArtistRow(row) {
  return {
    artistType: row.artist_type ?? null,
    country: row.country ?? null,
    disambiguation: row.disambiguation ?? null,
    id: row.musicbrainz_artist_id ?? String(row.id),
    lastRefreshedAt: normalizeDate(row.last_refreshed_at),
    localId: row.id,
    monitoredAt: normalizeDate(row.monitored_at),
    monitoredByUserId: row.monitored_by_user_id ?? null,
    monitoredByUsername: row.monitored_by_username ?? null,
    monitoredReleaseGroupTypes: normalizeReleaseGroupTypes(row.monitored_release_group_types),
    monitoringOperatorCount: row.monitoring_operator_count ?? 0,
    name: row.name,
    sortName: row.sort_name ?? null,
  };
}

export function createMetadataMonitoredArtistStore({
  getPoolFn = getPool,
} = {}) {
  /**
   * Returns a global, de-duplicated list of monitored artists for background
   * artwork prefetch. Artists with a null MusicBrainz id are retained so the
   * prefetch worker preserves its existing skip/summary semantics.
   *
   * @param {{ limit: number }} options
   * @returns {Promise<object[]>}
   */
  async function listMonitoredArtistsForArtwork({ limit } = {}) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT
          metadata_artists.id AS metadata_artist_id,
          metadata_artists.musicbrainz_artist_id,
          metadata_artists.name
        FROM operator_artist_monitoring
        JOIN metadata_artists
          ON metadata_artists.id = operator_artist_monitoring.metadata_artist_id
        WHERE operator_artist_monitoring.is_monitored = TRUE
        GROUP BY
          metadata_artists.id,
          metadata_artists.musicbrainz_artist_id,
          metadata_artists.name,
          metadata_artists.sort_name
        ORDER BY
          COALESCE(NULLIF(metadata_artists.sort_name, ''), metadata_artists.name) ASC,
          metadata_artists.id ASC
        LIMIT $1
      `,
      [normalizeLimit(limit)],
    );

    return result.rows.map((row) => ({
      metadataArtistId: row.metadata_artist_id,
      musicbrainzArtistId: row.musicbrainz_artist_id ?? null,
      name: row.name,
    }));
  }

  /**
   * Returns the admin oversight list: one row per monitored artist (de-duplicated),
   * aggregated across every operator monitoring that artist. Preserves the
   * legacy response shape and adds `monitoringOperatorCount`.
   *
   * @param {{ search?: string, sort?: string, limit?: number, offset?: number }} options
   * @returns {Promise<{ results: object[], limit: number, offset: number, total: number }>}
   */
  async function listAdminMonitoredArtists({ search, sort, limit, offset } = {}) {
    const pool = getPoolFn();
    const safeLimit = normalizeLimit(limit);
    const safeOffset = normalizeOffset(offset);
    const orderClause = ADMIN_MONITORED_SORT_COLUMNS.get(sort) ?? 'metadata_artists.name ASC';

    const conditions = [];
    const params = [];
    const trimmedSearch = typeof search === 'string' ? search.trim() : '';
    if (trimmedSearch.length > 0) {
      conditions.push(`(metadata_artists.name ILIKE '%' || $1 || '%' OR metadata_artists.sort_name ILIKE '%' || $1 || '%')`);
      params.push(trimmedSearch);
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : 'TRUE';
    const limitParamIndex = params.length + 1;
    const offsetParamIndex = params.length + 2;

    const operatorScopeCte = `
      WITH operator_scope AS (
        SELECT
          operator_artist_monitoring.metadata_artist_id,
          MAX(operator_artist_monitoring.updated_at) AS monitored_at,
          COUNT(DISTINCT operator_artist_monitoring.app_user_id)::integer AS monitoring_operator_count,
          (ARRAY_AGG(
            operator_artist_monitoring.app_user_id
            ORDER BY operator_artist_monitoring.updated_at DESC, operator_artist_monitoring.app_user_id
          ))[1] AS monitored_by_user_id
        FROM operator_artist_monitoring
        WHERE operator_artist_monitoring.is_monitored = TRUE
        GROUP BY operator_artist_monitoring.metadata_artist_id
      )`;

    const releaseTypesCte = `,
      release_types AS (
        SELECT
          operator_artist_monitoring.metadata_artist_id,
          ARRAY_AGG(DISTINCT release_type.type ORDER BY release_type.type) AS monitored_release_group_types
        FROM operator_artist_monitoring
        CROSS JOIN LATERAL unnest(operator_artist_monitoring.monitored_release_group_types) AS release_type(type)
        WHERE operator_artist_monitoring.is_monitored = TRUE
        GROUP BY operator_artist_monitoring.metadata_artist_id
      )`;

    const countResult = await pool.query(
      `${operatorScopeCte}
       SELECT COUNT(*)::integer AS total
       FROM operator_scope
       JOIN metadata_artists ON metadata_artists.id = operator_scope.metadata_artist_id
       WHERE ${whereClause}`,
      params,
    );

    const result = await pool.query(
      `${operatorScopeCte}${releaseTypesCte}
       SELECT
         metadata_artists.id,
         metadata_artists.name,
         metadata_artists.sort_name,
         metadata_artists.disambiguation,
         metadata_artists.country,
         metadata_artists.artist_type,
         metadata_artists.musicbrainz_artist_id,
         operator_scope.monitored_at,
         operator_scope.monitoring_operator_count,
         release_types.monitored_release_group_types,
         operator_scope.monitored_by_user_id,
         metadata_artist_refresh_state.last_refreshed_at,
         app_users.username AS monitored_by_username
       FROM operator_scope
       JOIN metadata_artists
         ON metadata_artists.id = operator_scope.metadata_artist_id
       LEFT JOIN release_types
         ON release_types.metadata_artist_id = operator_scope.metadata_artist_id
       LEFT JOIN metadata_artist_refresh_state
         ON metadata_artist_refresh_state.metadata_artist_id = operator_scope.metadata_artist_id
       LEFT JOIN app_users
         ON app_users.id = operator_scope.monitored_by_user_id
       WHERE ${whereClause}
       ORDER BY ${orderClause}
       LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
      [...params, safeLimit, safeOffset],
    );

  return {
    results: result.rows.map(mapAdminMonitoredArtistRow),
    limit: safeLimit,
    offset: safeOffset,
    total: countResult.rows[0]?.total ?? 0,
  };
  }

  /**
   * Returns the canonical artist monitoring status for the artist-detail
   * payload. Aggregates operator monitoring (`isMonitored`,
   * `monitoredReleaseGroupTypes`) and reads refresh cadence
   * (`lastRefreshedAt`, `nextRefreshAt`) from `metadata_artist_refresh_state`.
   *
   * Implemented as scalar subqueries with no `FROM`, so it always returns
   * exactly one row (each subquery yields `NULL` / `false` when no row
   * matches). Preserves the legacy payload shape.
   *
   * @param {string} metadataArtistId
   * @returns {Promise<{ isMonitored: boolean, monitoredReleaseGroupTypes: string[], lastRefreshedAt: string|null, nextRefreshAt: string|null }>}
   */
  async function getArtistMonitoringStatus(metadataArtistId) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT
          EXISTS (
            SELECT 1
            FROM operator_artist_monitoring
            WHERE operator_artist_monitoring.metadata_artist_id = $1
              AND operator_artist_monitoring.is_monitored = TRUE
          ) AS is_monitored,
          (
            SELECT ARRAY_AGG(DISTINCT release_type.type ORDER BY release_type.type)
            FROM operator_artist_monitoring
            CROSS JOIN LATERAL unnest(operator_artist_monitoring.monitored_release_group_types) AS release_type(type)
            WHERE operator_artist_monitoring.metadata_artist_id = $1
              AND operator_artist_monitoring.is_monitored = TRUE
          ) AS monitored_release_group_types,
          (
            SELECT metadata_artist_refresh_state.last_refreshed_at
            FROM metadata_artist_refresh_state
            WHERE metadata_artist_refresh_state.metadata_artist_id = $1
          ) AS last_refreshed_at,
          (
            SELECT metadata_artist_refresh_state.next_refresh_at
            FROM metadata_artist_refresh_state
            WHERE metadata_artist_refresh_state.metadata_artist_id = $1
          ) AS next_refresh_at
      `,
      [metadataArtistId],
    );

    const row = result.rows[0] ?? {};

    return {
      isMonitored: row.is_monitored === true,
      lastRefreshedAt: normalizeDate(row.last_refreshed_at),
      monitoredReleaseGroupTypes: normalizeReleaseGroupTypes(row.monitored_release_group_types),
      nextRefreshAt: normalizeDate(row.next_refresh_at),
    };
  }

  return {
    getArtistMonitoringStatus,
    listAdminMonitoredArtists,
    listMonitoredArtistsForArtwork,
  };
}
