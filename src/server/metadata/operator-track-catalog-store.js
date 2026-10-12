/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { getPool } from '../database.js';

export function createOperatorTrackCatalogStore({ getPoolFn = getPool } = {}) {
  async function listTrackCatalog({ metadataReleaseIds, queryable = null }) {
    if (!Array.isArray(metadataReleaseIds) || metadataReleaseIds.length === 0) return [];
    const result = await (queryable ?? getPoolFn()).query(`SELECT track.id AS metadata_track_id,
      medium.metadata_release_id, medium.position AS medium_position, track.position AS track_position,
      recording.musicbrainz_recording_id AS recording_mbid, track.title, track.length_ms
      FROM metadata_tracks track JOIN metadata_media medium ON medium.id=track.metadata_medium_id
      LEFT JOIN metadata_recordings recording ON recording.id=track.metadata_recording_id
      WHERE medium.metadata_release_id=ANY($1::uuid[])
      ORDER BY medium.metadata_release_id,medium.position,track.position,track.id`, [metadataReleaseIds]);
    return result.rows.map(row => ({ metadataTrackId: row.metadata_track_id,
      metadataReleaseId: row.metadata_release_id, recordingMbid: row.recording_mbid,
      mediumPosition: row.medium_position, trackPosition: row.track_position,
      title: row.title, lengthMs: row.length_ms }));
  }
  return { listTrackCatalog };
}
