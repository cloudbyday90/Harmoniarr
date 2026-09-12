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

/** Complete catalog identities for global summaries; never a display or edition payload. */
export function createMetadataArtistProjectionStore({ getPoolFn = getPool } = {}) {
  async function readArtistCatalogInputs(metadataArtistId) {
    const result = await getPoolFn().query(`
      SELECT release_group.id, release_group.primary_type,
        canonical.id AS canonical_release_id
      FROM metadata_release_groups AS release_group
      LEFT JOIN metadata_releases AS canonical
        ON canonical.metadata_release_group_id = release_group.id
        AND canonical.is_canonical = TRUE
      WHERE release_group.metadata_artist_id = $1
      ORDER BY release_group.first_release_date NULLS LAST,
        release_group.created_at ASC, release_group.title ASC, release_group.id ASC
    `, [metadataArtistId]);
    return result.rows;
  }
  return { readArtistCatalogInputs };
}
