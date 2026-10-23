/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { randomUUID } from 'node:crypto';

export async function createControlledProviderMetadata(pool, fixture) {
  const artist = await pool.query(
    `INSERT INTO metadata_artists (source_provider, source_artist_id, musicbrainz_artist_id, name, sort_name)
     VALUES ('controlled_fixture', $1, $2, $3, $3) RETURNING id`,
    [`artist-${fixture.id}`, randomUUID(), fixture.artistName],
  );
  const releaseGroup = await pool.query(
    `INSERT INTO metadata_release_groups (
      metadata_artist_id, source_provider, source_release_group_id, musicbrainz_release_group_id,
      title, primary_type, first_release_date
    ) VALUES ($1, 'controlled_fixture', $2, $3, $4, 'Album', '2026-01-01') RETURNING id`,
    [artist.rows[0].id, `group-${fixture.id}`, randomUUID(), fixture.releaseTitle],
  );
  const release = await pool.query(
    `INSERT INTO metadata_releases (
      metadata_release_group_id, source_provider, source_release_id, musicbrainz_release_id,
      title, status, release_date, track_count, medium_count, is_canonical
    ) VALUES ($1, 'controlled_fixture', $2, $3, $4, 'Official', '2026-01-01', 1, 1, TRUE) RETURNING id`,
    [releaseGroup.rows[0].id, `release-${fixture.id}`, randomUUID(), fixture.releaseTitle],
  );
  const medium = await pool.query(
    `INSERT INTO metadata_media (metadata_release_id, position, format, track_count)
     VALUES ($1, 1, 'Digital Media', 1) RETURNING id`,
    [release.rows[0].id],
  );
  const recording = await pool.query(
    `INSERT INTO metadata_recordings (
      source_provider, source_recording_id, musicbrainz_recording_id, title, length_ms, artist_credit
    ) VALUES ('controlled_fixture', $1, $2, $3, 3000, $4) RETURNING id`,
    [`recording-${fixture.id}`, randomUUID(), fixture.trackTitle, fixture.artistName],
  );
  await pool.query(
    `INSERT INTO metadata_tracks (
      metadata_medium_id, metadata_recording_id, position, number_text, title, length_ms, artist_credit
    ) VALUES ($1, $2, 1, '1', $3, 3000, $4)`,
    [medium.rows[0].id, recording.rows[0].id, fixture.trackTitle, fixture.artistName],
  );
  return { metadataArtistId: artist.rows[0].id, metadataReleaseGroupId: releaseGroup.rows[0].id,
    metadataReleaseId: release.rows[0].id };
}
