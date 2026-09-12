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
import { createMetadataArtistDiscographyStore } from './metadata-artist-discography-store.js';
import { encodeArtistDiscographyCursor, normalizeArtistDiscographyPage } from './metadata-artist-discography-policy.js';
import { mapMetadataReleaseGroup } from './metadata-release-group-presentation.js';

export function createMetadataArtistDiscographyService({ getPoolFn = getPool, store = null } = {}) {
  const readStore = store ?? createMetadataArtistDiscographyStore({ getPoolFn });

  async function getArtistDiscography(input) {
    const page = normalizeArtistDiscographyPage(input);
    if (!await readStore.artistExists(page.metadataArtistId)) {
      throw Object.assign(new Error('Metadata artist was not found'), { status: 404, code: 'metadata_not_found' });
    }
    const rows = await readStore.readPage(page);
    const hasMore = rows[0]?.has_more === true;
    return {
      releaseGroups: rows.map(mapMetadataReleaseGroup),
      pageInfo: {
        hasMore,
        nextCursor: hasMore ? encodeArtistDiscographyCursor(page.metadataArtistId, rows.at(-1).id) : null,
      },
    };
  }

  return { getArtistDiscography };
}
