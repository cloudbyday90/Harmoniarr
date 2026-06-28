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
import { createLibraryWantedReleaseStore } from './library-wanted-release-store.js';

function toInteger(value) {
  return Number.parseInt(String(value ?? 0), 10) || 0;
}

function normalizeReleaseDateForProjection(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }

  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-01-01`;
  }

  return null;
}

function mapWantedRow(row) {
  const expectedTrackCount = toInteger(row.expected_track_count);
  const matchedTrackCount = toInteger(row.matched_track_count);
  const missingTrackCount = Math.max(expectedTrackCount - matchedTrackCount, 0);

  return {
    appUserId: row.app_user_id,
    evidence: {
      monitoredReleaseGroupTypes: row.monitored_release_group_types ?? ['album', 'ep'],
      releaseScope: row.release_scope ?? 'future_only',
      reconciliationStatus: row.reconciliation_status ?? 'missing',
      strategy: row.reconciliation_status ? 'monitored_release_gap' : 'monitored_release_absent',
      wantedAutomationMode: row.wanted_automation_mode ?? 'future_matching',
    },
    expectedTrackCount,
    matchedTrackCount,
    metadataArtistId: row.metadata_artist_id,
    metadataReleaseGroupId: row.metadata_release_group_id,
    metadataReleaseId: row.metadata_release_id,
    missingTrackCount,
    releaseDate: normalizeReleaseDateForProjection(row.release_date),
    releaseStatus: row.release_status ?? null,
    wantedStatus: matchedTrackCount > 0 ? 'partial' : 'missing',
  };
}

const metadataReleaseComparableDateSql = `
  CASE
    WHEN metadata_releases.release_date ~ '^\\d{4}-\\d{2}-\\d{2}$'
      THEN metadata_releases.release_date::date
    WHEN metadata_releases.release_date ~ '^\\d{4}-\\d{2}$'
      THEN (metadata_releases.release_date || '-01')::date
    WHEN metadata_releases.release_date ~ '^\\d{4}$'
      THEN (metadata_releases.release_date || '-01-01')::date
    ELSE NULL
  END
`;

export function createLibraryWantedReleaseService({
  getPoolFn = getPool,
  libraryWantedReleaseStore = createLibraryWantedReleaseStore(),
} = {}) {
  async function loadWantedReleases() {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT
          operator_artist_monitoring.app_user_id,
          metadata_release_groups.metadata_artist_id,
          metadata_release_groups.id AS metadata_release_group_id,
          metadata_releases.id AS metadata_release_id,
          metadata_releases.release_date,
          metadata_releases.status AS release_status,
          operator_artist_monitoring.monitored_release_group_types,
          operator_artist_monitoring.release_scope,
          operator_artist_monitoring.wanted_automation_mode,
          COUNT(metadata_tracks.id)::integer AS expected_track_count,
          COALESCE(library_release_reconciliations.matched_track_count, 0)::integer AS matched_track_count,
          library_release_reconciliations.reconciliation_status
        FROM operator_artist_monitoring
        JOIN metadata_release_groups
          ON metadata_release_groups.metadata_artist_id = operator_artist_monitoring.metadata_artist_id
        JOIN metadata_releases
          ON metadata_releases.metadata_release_group_id = metadata_release_groups.id
        JOIN metadata_media
          ON metadata_media.metadata_release_id = metadata_releases.id
        JOIN metadata_tracks
          ON metadata_tracks.metadata_medium_id = metadata_media.id
        LEFT JOIN library_release_reconciliations
          ON library_release_reconciliations.metadata_release_id = metadata_releases.id
        WHERE operator_artist_monitoring.is_monitored = TRUE
          AND operator_artist_monitoring.release_scope <> 'track_only'
          AND operator_artist_monitoring.wanted_automation_mode <> 'manual_only'
          AND LOWER(TRIM(COALESCE(metadata_release_groups.primary_type, ''))) = ANY (
            ARRAY(
              SELECT LOWER(type_entry)
              FROM unnest(operator_artist_monitoring.monitored_release_group_types) AS type_entry
            )
          )
          AND COALESCE(metadata_releases.status, 'Official') = 'Official'
          AND COALESCE(library_release_reconciliations.reconciliation_status, 'missing') <> 'complete'
          AND COALESCE(library_release_reconciliations.reconciliation_status, 'missing') <> 'duplicate'
          AND (
            operator_artist_monitoring.release_scope = 'current_and_future'
            OR metadata_releases.release_date IS NULL
            OR (${metadataReleaseComparableDateSql}) >= operator_artist_monitoring.created_at::date
          )
          AND (
            operator_artist_monitoring.wanted_automation_mode = 'current_and_future_matching'
            OR metadata_releases.release_date IS NULL
            OR (${metadataReleaseComparableDateSql}) >= operator_artist_monitoring.created_at::date
          )
        GROUP BY
          operator_artist_monitoring.app_user_id,
          metadata_release_groups.metadata_artist_id,
          metadata_release_groups.id,
          metadata_releases.id,
          metadata_releases.release_date,
          metadata_releases.status,
          operator_artist_monitoring.monitored_release_group_types,
          operator_artist_monitoring.release_scope,
          operator_artist_monitoring.wanted_automation_mode,
          library_release_reconciliations.matched_track_count,
          library_release_reconciliations.reconciliation_status
        ORDER BY metadata_releases.release_date NULLS LAST, metadata_releases.id ASC
      `,
    );

    return result.rows.map(mapWantedRow);
  }

  async function reconcileWantedReleases() {
    const wantedReleases = await loadWantedReleases();
    await libraryWantedReleaseStore.replaceLibraryWantedReleases({ wantedReleases });
  }

  return {
    reconcileWantedReleases,
  };
}
