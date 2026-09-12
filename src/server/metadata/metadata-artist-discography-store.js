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

export function createMetadataArtistDiscographyStore({ getPoolFn = getPool } = {}) {
  async function artistExists(metadataArtistId) {
    const result = await getPoolFn().query('SELECT id FROM metadata_artists WHERE id = $1::uuid', [metadataArtistId]);
    return result.rows.length > 0;
  }

  async function readPage({ metadataArtistId, afterId, limit }) {
    const result = await getPoolFn().query(`
      WITH candidates AS MATERIALIZED (
        SELECT id FROM metadata_release_groups
        WHERE metadata_artist_id = $1::uuid
          AND ($2::uuid IS NULL OR id > $2::uuid)
        ORDER BY id ASC
        LIMIT $3::integer + 1
      ), page AS MATERIALIZED (
        SELECT id FROM candidates ORDER BY id ASC LIMIT $3::integer
      )
      SELECT release_group.*,
        (SELECT COUNT(*)::integer FROM metadata_releases AS edition
          WHERE edition.metadata_release_group_id = release_group.id) AS release_count,
        (SELECT COUNT(*) > $3::integer FROM candidates) AS has_more
      FROM page
      JOIN metadata_release_groups AS release_group ON release_group.id = page.id
      ORDER BY release_group.id ASC
    `, [metadataArtistId, afterId, limit]);
    return result.rows;
  }

  return { artistExists, readPage };
}
