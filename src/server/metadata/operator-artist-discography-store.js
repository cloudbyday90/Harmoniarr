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
import { normalizeOperatorReleaseGroupSelectionRow } from './operator-release-group-selection-policy.js';
import { normalizeOperatorTrackOverrideRow } from './operator-track-override-policy.js';
import { mapMetadataRelease } from './metadata-release-presentation.js';

export function createOperatorArtistDiscographyStore({ getPoolFn = getPool } = {}) {
  async function readPageState({ appUserId, metadataArtistId, releaseGroupIds }) {
    const pool = getPoolFn();
    const parameters = [appUserId, metadataArtistId, releaseGroupIds];
    const [monitoring, selections, overrides, releases] = await Promise.all([
      pool.query(`SELECT monitored_release_group_types FROM operator_artist_monitoring
        WHERE app_user_id = $1 AND metadata_artist_id = $2`, parameters.slice(0, 2)),
      pool.query(`SELECT * FROM operator_release_group_selection
        WHERE app_user_id = $1 AND metadata_artist_id = $2 AND metadata_release_group_id = ANY($3::uuid[])`, parameters),
      pool.query(`SELECT * FROM operator_track_override
        WHERE app_user_id = $1 AND metadata_artist_id = $2 AND metadata_release_group_id = ANY($3::uuid[])`, parameters),
      pool.query(`SELECT release.*, release_group.title AS release_group_title,
          release_group.musicbrainz_release_group_id AS release_group_musicbrainz_release_group_id
        FROM metadata_releases AS release
        JOIN metadata_release_groups AS release_group ON release_group.id = release.metadata_release_group_id
        WHERE release_group.metadata_artist_id = $2 AND release_group.id = ANY($3::uuid[])
          AND (release.is_canonical OR EXISTS (
            SELECT 1 FROM operator_release_group_selection AS selection
            WHERE selection.app_user_id = $1 AND selection.metadata_artist_id = $2
              AND selection.metadata_release_group_id = release_group.id
              AND selection.resolved_metadata_release_id = release.id
          ))
        ORDER BY release.id`, parameters),
    ]);
    return {
      monitoredReleaseGroupTypes: monitoring.rows[0]?.monitored_release_group_types,
      releaseGroupSelections: selections.rows.map(normalizeOperatorReleaseGroupSelectionRow),
      trackOverrides: overrides.rows.map(normalizeOperatorTrackOverrideRow),
      releases: releases.rows.map(mapMetadataRelease),
    };
  }
  return { readPageState };
}
