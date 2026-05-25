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
import { normalizeOperatorTrackOverrideRow } from './operator-track-override-policy.js';

function buildIdentityWhereClause({ trackMbid }) {
  if (trackMbid) {
    return `
      app_user_id = $1
      AND metadata_release_group_id = $2
      AND track_mbid = $3
    `;
  }

  return `
    app_user_id = $1
    AND metadata_release_group_id = $2
    AND track_mbid IS NULL
    AND metadata_release_id IS NOT DISTINCT FROM $3
    AND recording_mbid = $4
    AND medium_position = $5
    AND track_position = $6
  `;
}

function buildIdentityParameters({
  appUserId,
  metadataReleaseGroupId,
  metadataReleaseId,
  recordingMbid,
  trackMbid,
  mediumPosition,
  trackPosition,
}) {
  if (trackMbid) {
    return [
      appUserId,
      metadataReleaseGroupId,
      trackMbid,
    ];
  }

  return [
    appUserId,
    metadataReleaseGroupId,
    metadataReleaseId ?? null,
    recordingMbid ?? null,
    mediumPosition ?? null,
    trackPosition ?? null,
  ];
}

export function createOperatorTrackOverrideStore({
  getPoolFn = getPool,
} = {}) {
  async function getOperatorTrackOverride({
    appUserId,
    metadataReleaseGroupId,
    metadataReleaseId = null,
    recordingMbid = null,
    trackMbid = null,
    mediumPosition = null,
    trackPosition = null,
  }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT *
        FROM operator_track_override
        WHERE ${buildIdentityWhereClause({ trackMbid })}
        LIMIT 1
      `,
      buildIdentityParameters({
        appUserId,
        metadataReleaseGroupId,
        metadataReleaseId,
        recordingMbid,
        trackMbid,
        mediumPosition,
        trackPosition,
      }),
    );

    if (result.rows.length === 0) {
      return null;
    }

    return normalizeOperatorTrackOverrideRow(result.rows[0]);
  }

  async function upsertOperatorTrackOverride({
    appUserId,
    isDesired,
    mediumPosition = null,
    metadataArtistId,
    metadataReleaseGroupId,
    metadataReleaseId = null,
    recordingMbid = null,
    remapStatus,
    trackLengthMsSnapshot = null,
    trackMbid = null,
    trackPosition = null,
    trackTitleSnapshot = null,
  }) {
    const pool = getPoolFn();
    const client = await pool.connect();
    const identityParameters = buildIdentityParameters({
      appUserId,
      metadataReleaseGroupId,
      metadataReleaseId,
      recordingMbid,
      trackMbid,
      mediumPosition,
      trackPosition,
    });

    try {
      await client.query('BEGIN');
      await client.query(
        `
          DELETE FROM operator_track_override
          WHERE ${buildIdentityWhereClause({ trackMbid })}
        `,
        identityParameters,
      );
      await client.query(
        `
          INSERT INTO operator_track_override (
            app_user_id,
            metadata_artist_id,
            metadata_release_group_id,
            metadata_release_id,
            recording_mbid,
            track_mbid,
            medium_position,
            track_position,
            track_title_snapshot,
            track_length_ms_snapshot,
            is_desired,
            remap_status,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5::uuid, $6::uuid, $7, $8, $9, $10, $11, $12, NOW())
        `,
        [
          appUserId,
          metadataArtistId,
          metadataReleaseGroupId,
          metadataReleaseId,
          recordingMbid,
          trackMbid,
          mediumPosition,
          trackPosition,
          trackTitleSnapshot,
          trackLengthMsSnapshot,
          isDesired,
          remapStatus,
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function listOperatorTrackOverridesSnapshot() {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT *
        FROM operator_track_override
        ORDER BY app_user_id ASC, metadata_artist_id ASC, metadata_release_group_id ASC, created_at ASC
      `,
    );

    return result.rows.map((row) => normalizeOperatorTrackOverrideRow(row));
  }

  async function replaceOperatorTrackOverridesSnapshot({
    operatorTrackOverrides = [],
  } = {}) {
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM operator_track_override');

      for (const row of operatorTrackOverrides) {
        await client.query(
          `
            INSERT INTO operator_track_override (
              app_user_id,
              metadata_artist_id,
              metadata_release_group_id,
              metadata_release_id,
              recording_mbid,
              track_mbid,
              medium_position,
              track_position,
              track_title_snapshot,
              track_length_ms_snapshot,
              is_desired,
              remap_status,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5::uuid, $6::uuid, $7, $8, $9, $10, $11, $12, NOW())
          `,
          [
            row.appUserId,
            row.metadataArtistId,
            row.metadataReleaseGroupId,
            row.metadataReleaseId ?? null,
            row.recordingMbid ?? null,
            row.trackMbid ?? null,
            row.mediumPosition ?? null,
            row.trackPosition ?? null,
            row.trackTitleSnapshot ?? null,
            row.trackLengthMsSnapshot ?? null,
            row.isDesired === true,
            row.remapStatus ?? 'resolved',
          ],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    getOperatorTrackOverride,
    listOperatorTrackOverridesSnapshot,
    replaceOperatorTrackOverridesSnapshot,
    upsertOperatorTrackOverride,
  };
}
