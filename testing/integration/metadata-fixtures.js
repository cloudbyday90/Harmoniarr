import { randomUUID } from 'node:crypto';

export async function seedMetadataReleaseFixture({
  artistName = 'Autechre',
  firstReleaseDate = '1994-11-07',
  queryable,
  releaseDate = '1994-11-07',
  releaseTitle = 'Amber',
  trackLengthMs = 322000,
  trackTitle = 'Foil',
} = {}) {
  const artistResult = await queryable.query(
    `
      INSERT INTO metadata_artists (
        source_provider,
        source_artist_id,
        musicbrainz_artist_id,
        name,
        sort_name
      )
      VALUES ('musicbrainz', $1, $2, $3, $3)
      RETURNING id
    `,
    [`artist-${randomUUID()}`, randomUUID(), artistName],
  );
  const metadataArtistId = artistResult.rows[0].id;

  const releaseGroupResult = await queryable.query(
    `
      INSERT INTO metadata_release_groups (
        metadata_artist_id,
        source_provider,
        source_release_group_id,
        musicbrainz_release_group_id,
        title,
        primary_type,
        first_release_date
      )
      VALUES ($1, 'musicbrainz', $2, $3, $4, 'Album', $5)
      RETURNING id
    `,
    [metadataArtistId, `release-group-${randomUUID()}`, randomUUID(), releaseTitle, firstReleaseDate],
  );
  const metadataReleaseGroupId = releaseGroupResult.rows[0].id;

  const releaseResult = await queryable.query(
    `
      INSERT INTO metadata_releases (
        metadata_release_group_id,
        source_provider,
        source_release_id,
        musicbrainz_release_id,
        title,
        status,
        release_date,
        track_count,
        medium_count,
        is_canonical
      )
      VALUES ($1, 'musicbrainz', $2, $3, $4, 'Official', $5, 1, 1, TRUE)
      RETURNING id
    `,
    [metadataReleaseGroupId, `release-${randomUUID()}`, randomUUID(), releaseTitle, releaseDate],
  );
  const metadataReleaseId = releaseResult.rows[0].id;

  const mediumResult = await queryable.query(
    `
      INSERT INTO metadata_media (
        metadata_release_id,
        position,
        format,
        track_count
      )
      VALUES ($1, 1, 'CD', 1)
      RETURNING id
    `,
    [metadataReleaseId],
  );
  const metadataMediumId = mediumResult.rows[0].id;

  const recordingResult = await queryable.query(
    `
      INSERT INTO metadata_recordings (
        source_provider,
        source_recording_id,
        musicbrainz_recording_id,
        title,
        length_ms,
        artist_credit
      )
      VALUES ('musicbrainz', $1, $2, $3, $4, $5)
      RETURNING id
    `,
    [`recording-${randomUUID()}`, randomUUID(), trackTitle, trackLengthMs, artistName],
  );
  const metadataRecordingId = recordingResult.rows[0].id;

  const trackResult = await queryable.query(
    `
      INSERT INTO metadata_tracks (
        metadata_medium_id,
        metadata_recording_id,
        position,
        number_text,
        title,
        length_ms,
        artist_credit
      )
      VALUES ($1, $2, 1, '1', $3, $4, $5)
      RETURNING id
    `,
    [metadataMediumId, metadataRecordingId, trackTitle, trackLengthMs, artistName],
  );

  return {
    metadataArtistId,
    metadataMediumId,
    metadataRecordingId,
    metadataReleaseGroupId,
    metadataReleaseId,
    metadataTrackId: trackResult.rows[0].id,
  };
}
