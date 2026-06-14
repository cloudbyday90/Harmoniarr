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
 * Normalizes a release-group date value from DB to an ISO date string (YYYY-MM-DD).
 * @param {Date|string|null} value
 * @returns {string|null}
 */
function normalizeDateString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
}

/**
 * Maps a raw DB row from the radar query to a normalized radar release shape.
 * @param {object} row
 * @returns {object}
 */
function mapRadarRow(row) {
  return {
    artistName: row.artist_name ?? null,
    firstReleaseDate: normalizeDateString(row.first_release_date),
    metadataArtistId: row.metadata_artist_id,
    metadataReleaseGroupId: row.metadata_release_group_id,
    musicbrainzArtistId: row.musicbrainz_artist_id ?? null,
    musicbrainzReleaseGroupId: row.musicbrainz_release_group_id ?? null,
    releaseGroupTitle: row.title ?? null,
    releaseGroupType: row.primary_type ?? null,
  };
}

export function createLibraryReleaseRadarStore({
  getPoolFn = getPool,
} = {}) {
  /**
   * Returns all operator-monitored release groups whose `first_release_date`
   * falls within [since, until] (inclusive). Ordered by date ascending so the
   * caller can split at `now` to obtain recent vs. upcoming arrays.
   *
   * @param {{ appUserId: string, since: Date, until: Date, limit: number }} options
   * @returns {Promise<object[]>}
   */
  async function listRadarReleaseGroups({ appUserId, since, until, limit }) {
    const result = await getPoolFn().query(
      `
        SELECT
          mrg.id AS metadata_release_group_id,
          mrg.musicbrainz_release_group_id,
          mrg.title,
          mrg.primary_type,
          mrg.first_release_date,
          ma.id AS metadata_artist_id,
          ma.name AS artist_name,
          ma.musicbrainz_artist_id
        FROM metadata_release_groups mrg
        JOIN operator_artist_monitoring oam
          ON oam.metadata_artist_id = mrg.metadata_artist_id
        JOIN metadata_artists ma
          ON ma.id = mrg.metadata_artist_id
        WHERE oam.app_user_id = $1
          AND oam.is_monitored = TRUE
          AND mrg.first_release_date IS NOT NULL
          AND mrg.first_release_date >= $2
          AND mrg.first_release_date <= $3
        ORDER BY mrg.first_release_date ASC
        LIMIT $4
      `,
      [appUserId, since, until, limit],
    );

    return result.rows.map(mapRadarRow);
  }

  return {
    listRadarReleaseGroups,
  };
}
