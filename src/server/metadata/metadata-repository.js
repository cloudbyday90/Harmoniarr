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

function resolveQueryable(queryable) {
  return queryable ?? getPool();
}

export async function upsertMetadataArtist(artist, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      INSERT INTO metadata_artists (
        source_provider,
        source_artist_id,
        musicbrainz_artist_id,
        name,
        sort_name,
        disambiguation,
        country,
        artist_type,
        begin_date,
        end_date,
        raw_payload,
        fetched_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, NOW())
      ON CONFLICT (source_provider, source_artist_id) DO UPDATE
      SET musicbrainz_artist_id = EXCLUDED.musicbrainz_artist_id,
          name = EXCLUDED.name,
          sort_name = EXCLUDED.sort_name,
          disambiguation = EXCLUDED.disambiguation,
          country = EXCLUDED.country,
          artist_type = EXCLUDED.artist_type,
          begin_date = EXCLUDED.begin_date,
          end_date = EXCLUDED.end_date,
          raw_payload = EXCLUDED.raw_payload,
          fetched_at = EXCLUDED.fetched_at,
          updated_at = NOW()
      RETURNING *
    `,
    [
      artist.sourceProvider,
      artist.sourceArtistId,
      artist.musicbrainzArtistId ?? null,
      artist.name,
      artist.sortName ?? null,
      artist.disambiguation ?? null,
      artist.country ?? null,
      artist.artistType ?? null,
      artist.beginDate ?? null,
      artist.endDate ?? null,
      artist.rawPayload ? JSON.stringify(artist.rawPayload) : null,
      artist.fetchedAt ?? null,
    ],
  );

  return result.rows[0];
}

export async function replaceMetadataArtistAliases(metadataArtistId, aliases, queryable) {
  const db = resolveQueryable(queryable);

  await db.query('DELETE FROM metadata_artist_aliases WHERE metadata_artist_id = $1', [metadataArtistId]);

  for (const alias of aliases) {
    await db.query(
      `
        INSERT INTO metadata_artist_aliases (
          metadata_artist_id,
          alias,
          locale,
          is_primary
        )
        VALUES ($1, $2, $3, $4)
      `,
      [metadataArtistId, alias.alias, alias.locale ?? null, alias.isPrimary ?? false],
    );
  }
}

export async function upsertMetadataReleaseGroup(releaseGroup, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      INSERT INTO metadata_release_groups (
        metadata_artist_id,
        source_provider,
        source_release_group_id,
        musicbrainz_release_group_id,
        title,
        primary_type,
        secondary_types,
        first_release_date,
        disambiguation,
        raw_payload,
        fetched_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9, $10::jsonb, $11, NOW())
      ON CONFLICT (source_provider, source_release_group_id) DO UPDATE
      SET metadata_artist_id = EXCLUDED.metadata_artist_id,
          musicbrainz_release_group_id = EXCLUDED.musicbrainz_release_group_id,
          title = EXCLUDED.title,
          primary_type = EXCLUDED.primary_type,
          secondary_types = EXCLUDED.secondary_types,
          first_release_date = EXCLUDED.first_release_date,
          disambiguation = EXCLUDED.disambiguation,
          raw_payload = EXCLUDED.raw_payload,
          fetched_at = EXCLUDED.fetched_at,
          updated_at = NOW()
      RETURNING *
    `,
    [
      releaseGroup.metadataArtistId,
      releaseGroup.sourceProvider,
      releaseGroup.sourceReleaseGroupId,
      releaseGroup.musicbrainzReleaseGroupId ?? null,
      releaseGroup.title,
      releaseGroup.primaryType ?? null,
      releaseGroup.secondaryTypes ?? [],
      releaseGroup.firstReleaseDate ?? null,
      releaseGroup.disambiguation ?? null,
      releaseGroup.rawPayload ? JSON.stringify(releaseGroup.rawPayload) : null,
      releaseGroup.fetchedAt ?? null,
    ],
  );

  return result.rows[0];
}

export async function upsertMetadataRelease(release, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      INSERT INTO metadata_releases (
        metadata_release_group_id,
        source_provider,
        source_release_id,
        musicbrainz_release_id,
        title,
        status,
        release_date,
        country,
        barcode,
        disambiguation,
        track_count,
        medium_count,
        raw_payload,
        fetched_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, NOW())
      ON CONFLICT (source_provider, source_release_id) DO UPDATE
      SET metadata_release_group_id = EXCLUDED.metadata_release_group_id,
          musicbrainz_release_id = EXCLUDED.musicbrainz_release_id,
          title = EXCLUDED.title,
          status = EXCLUDED.status,
          release_date = EXCLUDED.release_date,
          country = EXCLUDED.country,
          barcode = EXCLUDED.barcode,
          disambiguation = EXCLUDED.disambiguation,
          track_count = EXCLUDED.track_count,
          medium_count = EXCLUDED.medium_count,
          raw_payload = EXCLUDED.raw_payload,
          fetched_at = EXCLUDED.fetched_at,
          updated_at = NOW()
      RETURNING *
    `,
    [
      release.metadataReleaseGroupId,
      release.sourceProvider,
      release.sourceReleaseId,
      release.musicbrainzReleaseId ?? null,
      release.title,
      release.status ?? null,
      release.releaseDate ?? null,
      release.country ?? null,
      release.barcode ?? null,
      release.disambiguation ?? null,
      release.trackCount ?? null,
      release.mediumCount ?? null,
      release.rawPayload ? JSON.stringify(release.rawPayload) : null,
      release.fetchedAt ?? null,
    ],
  );

  return result.rows[0];
}

export async function deleteMetadataMediaByReleaseId(metadataReleaseId, queryable) {
  const db = resolveQueryable(queryable);
  await db.query('DELETE FROM metadata_media WHERE metadata_release_id = $1', [metadataReleaseId]);
}

export async function insertMetadataMedium(medium, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      INSERT INTO metadata_media (
        metadata_release_id,
        position,
        title,
        format,
        track_count,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `,
    [
      medium.metadataReleaseId,
      medium.position,
      medium.title ?? null,
      medium.format ?? null,
      medium.trackCount ?? null,
    ],
  );

  return result.rows[0];
}

export async function upsertMetadataRecording(recording, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      INSERT INTO metadata_recordings (
        source_provider,
        source_recording_id,
        musicbrainz_recording_id,
        title,
        length_ms,
        artist_credit,
        raw_payload,
        fetched_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())
      ON CONFLICT (source_provider, source_recording_id) DO UPDATE
      SET musicbrainz_recording_id = EXCLUDED.musicbrainz_recording_id,
          title = EXCLUDED.title,
          length_ms = EXCLUDED.length_ms,
          artist_credit = EXCLUDED.artist_credit,
          raw_payload = EXCLUDED.raw_payload,
          fetched_at = EXCLUDED.fetched_at,
          updated_at = NOW()
      RETURNING *
    `,
    [
      recording.sourceProvider,
      recording.sourceRecordingId,
      recording.musicbrainzRecordingId ?? null,
      recording.title,
      recording.lengthMs ?? null,
      recording.artistCredit ?? null,
      recording.rawPayload ? JSON.stringify(recording.rawPayload) : null,
      recording.fetchedAt ?? null,
    ],
  );

  return result.rows[0];
}

export async function insertMetadataTrack(track, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      INSERT INTO metadata_tracks (
        metadata_medium_id,
        metadata_recording_id,
        position,
        number_text,
        title,
        length_ms,
        artist_credit,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `,
    [
      track.metadataMediumId,
      track.metadataRecordingId ?? null,
      track.position,
      track.numberText ?? null,
      track.title,
      track.lengthMs ?? null,
      track.artistCredit ?? null,
    ],
  );

  return result.rows[0];
}

export async function insertMetadataProviderSnapshot(snapshot, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      INSERT INTO metadata_provider_snapshots (
        provider,
        entity_type,
        entity_id,
        source_identifier,
        payload_checksum,
        raw_payload,
        normalized_payload,
        fetched_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
      RETURNING *
    `,
    [
      snapshot.provider,
      snapshot.entityType,
      snapshot.entityId ?? null,
      snapshot.sourceIdentifier ?? null,
      snapshot.payloadChecksum ?? null,
      JSON.stringify(snapshot.rawPayload),
      snapshot.normalizedPayload ? JSON.stringify(snapshot.normalizedPayload) : null,
      snapshot.fetchedAt,
    ],
  );

  return result.rows[0];
}

export async function getMetadataArtistById(metadataArtistId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    'SELECT * FROM metadata_artists WHERE id = $1 LIMIT 1',
    [metadataArtistId],
  );

  return result.rows[0] ?? null;
}

export async function getMetadataArtistByMusicBrainzArtistId(musicBrainzArtistId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    'SELECT * FROM metadata_artists WHERE musicbrainz_artist_id = $1 LIMIT 1',
    [musicBrainzArtistId],
  );

  return result.rows[0] ?? null;
}

export async function listMetadataArtistAliases(metadataArtistId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      SELECT *
      FROM metadata_artist_aliases
      WHERE metadata_artist_id = $1
      ORDER BY is_primary DESC, created_at ASC, alias ASC
    `,
    [metadataArtistId],
  );

  return result.rows;
}

export async function getMetadataReleaseGroupById(metadataReleaseGroupId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    'SELECT * FROM metadata_release_groups WHERE id = $1 LIMIT 1',
    [metadataReleaseGroupId],
  );

  return result.rows[0] ?? null;
}

export async function getMetadataReleaseGroupByMusicBrainzReleaseGroupId(musicBrainzReleaseGroupId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    'SELECT * FROM metadata_release_groups WHERE musicbrainz_release_group_id = $1 LIMIT 1',
    [musicBrainzReleaseGroupId],
  );

  return result.rows[0] ?? null;
}

export async function listMetadataReleaseGroupsByArtistId(metadataArtistId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      SELECT
        metadata_release_groups.*,
        COUNT(metadata_releases.id)::integer AS release_count
      FROM metadata_release_groups
      LEFT JOIN metadata_releases
        ON metadata_releases.metadata_release_group_id = metadata_release_groups.id
      WHERE metadata_release_groups.metadata_artist_id = $1
      GROUP BY metadata_release_groups.id
      ORDER BY metadata_release_groups.first_release_date NULLS LAST,
               metadata_release_groups.created_at ASC,
               metadata_release_groups.title ASC
    `,
    [metadataArtistId],
  );

  return result.rows;
}

export async function listMetadataReleasesByReleaseGroupId(metadataReleaseGroupId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      SELECT *
      FROM metadata_releases
      WHERE metadata_release_group_id = $1
      ORDER BY release_date NULLS LAST, created_at ASC, title ASC
    `,
    [metadataReleaseGroupId],
  );

  return result.rows;
}

export async function listMetadataReleasesByArtistId(metadataArtistId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      SELECT
        metadata_releases.*,
        metadata_release_groups.title AS release_group_title,
        metadata_release_groups.musicbrainz_release_group_id AS release_group_musicbrainz_release_group_id
      FROM metadata_releases
      JOIN metadata_release_groups
        ON metadata_release_groups.id = metadata_releases.metadata_release_group_id
      WHERE metadata_release_groups.metadata_artist_id = $1
      ORDER BY metadata_releases.release_date NULLS LAST,
               metadata_releases.created_at ASC,
               metadata_releases.title ASC
    `,
    [metadataArtistId],
  );

  return result.rows;
}

export async function getMetadataReleaseById(metadataReleaseId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    'SELECT * FROM metadata_releases WHERE id = $1 LIMIT 1',
    [metadataReleaseId],
  );

  return result.rows[0] ?? null;
}

export async function getMetadataReleaseByMusicBrainzReleaseId(musicBrainzReleaseId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    'SELECT * FROM metadata_releases WHERE musicbrainz_release_id = $1 LIMIT 1',
    [musicBrainzReleaseId],
  );

  return result.rows[0] ?? null;
}

export async function listMetadataMediaByReleaseId(metadataReleaseId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      SELECT *
      FROM metadata_media
      WHERE metadata_release_id = $1
      ORDER BY position ASC
    `,
    [metadataReleaseId],
  );

  return result.rows;
}

export async function listMetadataTracksByReleaseId(metadataReleaseId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      SELECT
        metadata_tracks.*,
        metadata_recordings.id AS recording_id,
        metadata_recordings.source_provider AS recording_source_provider,
        metadata_recordings.source_recording_id AS recording_source_recording_id,
        metadata_recordings.musicbrainz_recording_id AS recording_musicbrainz_recording_id,
        metadata_recordings.title AS recording_title,
        metadata_recordings.length_ms AS recording_length_ms,
        metadata_recordings.artist_credit AS recording_artist_credit,
        metadata_recordings.fetched_at AS recording_fetched_at,
        metadata_recordings.updated_at AS recording_updated_at
      FROM metadata_tracks
      JOIN metadata_media ON metadata_media.id = metadata_tracks.metadata_medium_id
      LEFT JOIN metadata_recordings ON metadata_recordings.id = metadata_tracks.metadata_recording_id
      WHERE metadata_media.metadata_release_id = $1
      ORDER BY metadata_media.position ASC, metadata_tracks.position ASC
    `,
    [metadataReleaseId],
  );

  return result.rows;
}

export async function searchMetadataArtists({ query, limit }, queryable) {
  const db = resolveQueryable(queryable);
  const searchPattern = `%${query}%`;
  const result = await db.query(
    `
      SELECT *
      FROM metadata_artists
      WHERE name ILIKE $1
         OR sort_name ILIKE $1
         OR COALESCE(disambiguation, '') ILIKE $1
      ORDER BY
        CASE
          WHEN name ILIKE $2 THEN 0
          WHEN sort_name ILIKE $2 THEN 1
          ELSE 2
        END,
        updated_at DESC,
        name ASC
      LIMIT $3
    `,
    [searchPattern, `${query}%`, limit],
  );

  return result.rows;
}

export async function searchMetadataReleaseGroups({ query, limit }, queryable) {
  const db = resolveQueryable(queryable);
  const searchPattern = `%${query}%`;
  const result = await db.query(
    `
      SELECT
        metadata_release_groups.*,
        metadata_artists.name AS artist_name,
        COUNT(metadata_releases.id)::integer AS release_count
      FROM metadata_release_groups
      JOIN metadata_artists
        ON metadata_artists.id = metadata_release_groups.metadata_artist_id
      LEFT JOIN metadata_releases
        ON metadata_releases.metadata_release_group_id = metadata_release_groups.id
      WHERE metadata_release_groups.title ILIKE $1
         OR metadata_artists.name ILIKE $1
         OR COALESCE(metadata_release_groups.disambiguation, '') ILIKE $1
      GROUP BY metadata_release_groups.id, metadata_artists.name
      ORDER BY
        CASE
          WHEN metadata_release_groups.title ILIKE $2 THEN 0
          WHEN metadata_artists.name ILIKE $2 THEN 1
          ELSE 2
        END,
        metadata_release_groups.updated_at DESC,
        metadata_release_groups.title ASC
      LIMIT $3
    `,
    [searchPattern, `${query}%`, limit],
  );

  return result.rows;
}

export async function searchMetadataReleases({ query, limit }, queryable) {
  const db = resolveQueryable(queryable);
  const searchPattern = `%${query}%`;
  const result = await db.query(
    `
      SELECT
        metadata_releases.*,
        metadata_release_groups.title AS release_group_title,
        metadata_artists.id AS metadata_artist_id,
        metadata_artists.name AS artist_name
      FROM metadata_releases
      JOIN metadata_release_groups
        ON metadata_release_groups.id = metadata_releases.metadata_release_group_id
      JOIN metadata_artists
        ON metadata_artists.id = metadata_release_groups.metadata_artist_id
      WHERE metadata_releases.title ILIKE $1
         OR metadata_release_groups.title ILIKE $1
         OR metadata_artists.name ILIKE $1
         OR COALESCE(metadata_releases.disambiguation, '') ILIKE $1
      ORDER BY
        CASE
          WHEN metadata_releases.title ILIKE $2 THEN 0
          WHEN metadata_release_groups.title ILIKE $2 THEN 1
          WHEN metadata_artists.name ILIKE $2 THEN 2
          ELSE 3
        END,
        metadata_releases.updated_at DESC,
        metadata_releases.title ASC
      LIMIT $3
    `,
    [searchPattern, `${query}%`, limit],
  );

  return result.rows;
}