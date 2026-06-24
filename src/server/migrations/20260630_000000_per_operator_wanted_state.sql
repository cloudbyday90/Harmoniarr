-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

ALTER TABLE library_wanted_releases
  ADD COLUMN IF NOT EXISTS app_user_id UUID NULL REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE library_wanted_releases
  DROP CONSTRAINT IF EXISTS library_wanted_releases_metadata_release_id_key;

WITH existing_global_wanted_rows AS (
  DELETE FROM library_wanted_releases
  WHERE app_user_id IS NULL
  RETURNING
    metadata_artist_id,
    metadata_release_group_id,
    metadata_release_id,
    wanted_status,
    expected_track_count,
    matched_track_count,
    missing_track_count,
    release_date,
    release_status,
    evidence,
    last_reconciled_at,
    created_at,
    updated_at
)
INSERT INTO library_wanted_releases (
  app_user_id,
  metadata_artist_id,
  metadata_release_group_id,
  metadata_release_id,
  wanted_status,
  expected_track_count,
  matched_track_count,
  missing_track_count,
  release_date,
  release_status,
  evidence,
  last_reconciled_at,
  created_at,
  updated_at
)
SELECT
  operator_artist_monitoring.app_user_id,
  existing_global_wanted_rows.metadata_artist_id,
  existing_global_wanted_rows.metadata_release_group_id,
  existing_global_wanted_rows.metadata_release_id,
  existing_global_wanted_rows.wanted_status,
  existing_global_wanted_rows.expected_track_count,
  existing_global_wanted_rows.matched_track_count,
  existing_global_wanted_rows.missing_track_count,
  existing_global_wanted_rows.release_date,
  existing_global_wanted_rows.release_status,
  COALESCE(existing_global_wanted_rows.evidence, '{}'::jsonb)
    || jsonb_build_object(
      'scopeMigration', 'per_operator_wanted_state',
      'scopeMigratedAt', NOW(),
      'sourceAppUserId', operator_artist_monitoring.app_user_id::text
    ),
  existing_global_wanted_rows.last_reconciled_at,
  existing_global_wanted_rows.created_at,
  NOW()
FROM existing_global_wanted_rows
JOIN operator_artist_monitoring
  ON operator_artist_monitoring.metadata_artist_id = existing_global_wanted_rows.metadata_artist_id
WHERE operator_artist_monitoring.is_monitored = TRUE;

ALTER TABLE library_wanted_releases
  ALTER COLUMN app_user_id SET NOT NULL;

ALTER TABLE library_wanted_releases
  ADD CONSTRAINT library_wanted_releases_user_release_unique
  UNIQUE (app_user_id, metadata_release_id);

CREATE INDEX IF NOT EXISTS library_wanted_releases_user_status_idx
  ON library_wanted_releases (app_user_id, wanted_status, last_reconciled_at DESC);

CREATE INDEX IF NOT EXISTS library_wanted_releases_user_artist_idx
  ON library_wanted_releases (app_user_id, metadata_artist_id, last_reconciled_at DESC);
