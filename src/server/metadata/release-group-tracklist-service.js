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
import {
  getMetadataReleaseGroupByMusicBrainzReleaseGroupId,
  listReleasesWithCanonicalByReleaseGroupId,
  listMetadataMediaByReleaseId,
  listMetadataTracksByReleaseId,
} from './metadata-repository.js';
import { createMusicBrainzCatalogService } from './musicbrainz-catalog-service.js';

function mapTracklistRelease(row) {
  return {
    id: row.id,
    musicbrainzReleaseId: row.musicbrainz_release_id ?? null,
    title: row.title,
    releaseDate: row.release_date ?? null,
    country: row.country ?? null,
    status: row.status ?? null,
    trackCount: row.track_count ?? null,
    mediumCount: row.medium_count ?? null,
    barcode: row.barcode ?? null,
    disambiguation: row.disambiguation ?? null,
    isCanonical: row.is_canonical ?? false,
  };
}

function mapTrack(row, ownedRecordingIds) {
  const recordingMbid = row.recording_musicbrainz_recording_id ?? null;
  const recordingId = row.recording_id ?? null;
  const isOwned = recordingId !== null && ownedRecordingIds !== null
    ? ownedRecordingIds.has(recordingId)
    : false;

  return {
    position: row.position,
    numberText: row.number_text ?? null,
    title: row.title,
    lengthMs: row.length_ms ?? row.recording_length_ms ?? null,
    artistCredit: row.artist_credit ?? row.recording_artist_credit ?? null,
    recordingMbid,
    isOwned,
  };
}

function mapMedium(row, tracks) {
  return {
    position: row.position,
    title: row.title ?? null,
    format: row.format ?? null,
    trackCount: row.track_count ?? tracks.length,
    tracks,
  };
}

/**
 * Queries `library_release_reconciliations` for the given release.
 * Returns null if no reconciliation record exists or matched_track_count = 0.
 * Returns the reconciliation shape if the release is fully or partially owned.
 */
async function getOwnership(releaseId, pool) {
  const { rows } = await pool.query(
    `
      SELECT reconciliation_status, expected_track_count, matched_track_count
      FROM library_release_reconciliations
      WHERE metadata_release_id = $1
      LIMIT 1
    `,
    [releaseId],
  );

  if (rows.length === 0 || rows[0].matched_track_count === 0) {
    return null;
  }

  return {
    matchedTrackCount: rows[0].matched_track_count,
    expectedTrackCount: rows[0].expected_track_count,
    reconciliationStatus: rows[0].reconciliation_status,
  };
}

/**
 * Returns the set of metadata_recording IDs that are "owned" (have matched
 * library files) for the given metadata_release_id.
 * Only called when `ownership` is non-null (matched_track_count > 0).
 */
async function getOwnedRecordingIds(releaseId, pool) {
  const { rows } = await pool.query(
    `
      SELECT DISTINCT mt.metadata_recording_id
      FROM library_file_matches lfm
      JOIN metadata_tracks mt ON mt.id = lfm.metadata_track_id
      JOIN metadata_media mm ON mm.id = mt.metadata_medium_id
      WHERE mm.metadata_release_id = $1
        AND lfm.match_decision = 'accepted'
    `,
    [releaseId],
  );

  return new Set(rows.map((r) => r.metadata_recording_id).filter(Boolean));
}

/**
 * Queries the latest active media_request for a session user scoped to a
 * release group.
 */
async function getRequestState(releaseGroupId, sessionUserId, pool) {
  if (!sessionUserId) return null;

  const { rows } = await pool.query(
    `
      SELECT id, request_state, created_at
      FROM media_requests
      WHERE (requested_by_user_id = $1 OR requested_for_user_id = $1)
        AND matched_metadata_release_group_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [sessionUserId, releaseGroupId],
  );

  if (rows.length === 0) return null;

  return {
    status: rows[0].request_state,
    requestId: rows[0].id,
    requestedAt: rows[0].created_at,
  };
}

/**
 * Selects the target release from the list of releases for a group, given
 * optional preferences.
 *
 * Priority:
 * 1. preferReleaseMbid match
 * 2. preferReleaseId match
 * 3. is_canonical = TRUE
 * 4. first in list
 */
function selectTargetRelease(rows, { preferReleaseMbid, preferReleaseId } = {}) {
  if (preferReleaseMbid) {
    const found = rows.find((r) => r.musicbrainz_release_id === preferReleaseMbid);
    if (found) return found;
  }
  if (preferReleaseId) {
    const found = rows.find((r) => r.id === preferReleaseId);
    if (found) return found;
  }
  const canonical = rows.find((r) => r.is_canonical === true);
  if (canonical) return canonical;
  return rows[0];
}

export function createReleaseGroupTracklistService({
  getPoolFn = getPool,
  musicBrainzCatalogService = createMusicBrainzCatalogService(),
  importMusicBrainzReleaseGroup = null,
} = {}) {
  async function getReleaseGroupTracklist({
    releaseGroupMbid,
    preferReleaseMbid = null,
    preferReleaseId = null,
    sessionUserId = null,
  }) {
    const pool = await getPoolFn();

    // ── Local path ───────────────────────────────────────────────────────────
    const releaseGroup = await getMetadataReleaseGroupByMusicBrainzReleaseGroupId(
      releaseGroupMbid,
      pool,
    );

    if (releaseGroup) {
      const releaseRows = await listReleasesWithCanonicalByReleaseGroupId(releaseGroup.id, pool);

      if (releaseRows.length === 0) {
        // Group imported but no releases yet — fall through to MB fallback.
        return buildMusicBrainzFallback({
          releaseGroupMbid,
          preferReleaseMbid,
          pool,
        });
      }

      const targetRow = selectTargetRelease(releaseRows, { preferReleaseMbid, preferReleaseId });

      const [mediaRows, trackRows, ownership] = await Promise.all([
        listMetadataMediaByReleaseId(targetRow.id, pool),
        listMetadataTracksByReleaseId(targetRow.id, pool),
        getOwnership(targetRow.id, pool),
      ]);

      // Only query file-level ownership when matched_track_count > 0.
      const ownedRecordingIds = ownership
        ? await getOwnedRecordingIds(targetRow.id, pool)
        : null;

      const tracksByMediumId = new Map();
      for (const trackRow of trackRows) {
        const list = tracksByMediumId.get(trackRow.metadata_medium_id) ?? [];
        list.push(mapTrack(trackRow, ownedRecordingIds));
        tracksByMediumId.set(trackRow.metadata_medium_id, list);
      }

      const media = mediaRows.map((mediumRow) =>
        mapMedium(mediumRow, tracksByMediumId.get(mediumRow.id) ?? []),
      );

      const [requestState] = await Promise.all([
        getRequestState(releaseGroup.id, sessionUserId, pool),
      ]);

      return {
        release: mapTracklistRelease(targetRow),
        media,
        ownership,
        allReleases: releaseRows.map(mapTracklistRelease),
        requestState,
        source: 'local',
      };
    }

    // ── MusicBrainz fallback ─────────────────────────────────────────────────
    return buildMusicBrainzFallback({ releaseGroupMbid, preferReleaseMbid, pool });
  }

  async function buildMusicBrainzFallback({ releaseGroupMbid, preferReleaseMbid, pool: _pool }) {
    const mbData = await musicBrainzCatalogService.getReleaseGroupReleases({
      releaseGroupId: releaseGroupMbid,
      limit: 100,
    });

    // Fire-and-forget import so the release group is available next time.
    if (importMusicBrainzReleaseGroup) {
      importMusicBrainzReleaseGroup({ releaseGroupId: releaseGroupMbid }).catch(() => {
        // Intentionally swallowed — background import failure is non-fatal.
      });
    }

    const mbReleases = mbData.results ?? [];

    // Select a target release from MB results.
    let targetRelease = mbReleases[0] ?? null;
    if (preferReleaseMbid) {
      const found = mbReleases.find((r) => r.musicbrainzReleaseId === preferReleaseMbid);
      if (found) targetRelease = found;
    }

    if (!targetRelease) {
      return {
        release: null,
        media: [],
        ownership: null,
        allReleases: [],
        requestState: null,
        source: 'musicbrainz',
      };
    }

    return {
      release: {
        id: null,
        musicbrainzReleaseId: targetRelease.musicbrainzReleaseId,
        title: targetRelease.title,
        releaseDate: targetRelease.releaseDate ?? null,
        country: targetRelease.country ?? null,
        status: targetRelease.status ?? null,
        trackCount: targetRelease.trackCount ?? null,
        mediumCount: targetRelease.mediumCount ?? null,
        barcode: targetRelease.barcode ?? null,
        disambiguation: targetRelease.disambiguation ?? null,
        isCanonical: false,
      },
      media: [],
      ownership: null,
      allReleases: mbReleases.map((r) => ({
        id: null,
        musicbrainzReleaseId: r.musicbrainzReleaseId,
        title: r.title,
        releaseDate: r.releaseDate ?? null,
        country: r.country ?? null,
        status: r.status ?? null,
        trackCount: r.trackCount ?? null,
        mediumCount: r.mediumCount ?? null,
        barcode: r.barcode ?? null,
        disambiguation: r.disambiguation ?? null,
        isCanonical: false,
      })),
      requestState: null,
      source: 'musicbrainz',
    };
  }

  return { getReleaseGroupTracklist };
}
