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

export function mapMetadataRelease(row) {
  return {
    id: row.id,
    releaseGroupId: row.metadata_release_group_id,
    releaseGroupTitle: row.release_group_title ?? null,
    releaseGroupMusicBrainzId: row.release_group_musicbrainz_release_group_id ?? null,
    title: row.title,
    status: row.status,
    releaseDate: row.release_date,
    country: row.country,
    barcode: row.barcode,
    disambiguation: row.disambiguation,
    trackCount: row.track_count,
    mediumCount: row.medium_count,
    isCanonical: row.is_canonical ?? false,
    source: {
      provider: row.source_provider,
      sourceReleaseId: row.source_release_id,
      musicbrainzReleaseId: row.musicbrainz_release_id,
    },
    fetchedAt: row.fetched_at,
    updatedAt: row.updated_at,
  };
}
