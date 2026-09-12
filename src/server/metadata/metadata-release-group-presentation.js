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

export function mapMetadataReleaseGroup(row) {
  return {
    id: row.id,
    artistId: row.metadata_artist_id,
    title: row.title,
    primaryType: row.primary_type,
    secondaryTypes: row.secondary_types,
    firstReleaseDate: row.first_release_date,
    disambiguation: row.disambiguation,
    releaseCount: row.release_count ?? 0,
    source: {
      provider: row.source_provider,
      sourceReleaseGroupId: row.source_release_group_id,
      musicbrainzReleaseGroupId: row.musicbrainz_release_group_id,
    },
    fetchedAt: row.fetched_at,
    updatedAt: row.updated_at,
  };
}
