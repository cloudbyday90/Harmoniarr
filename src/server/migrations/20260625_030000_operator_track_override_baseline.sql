--
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

CREATE TABLE IF NOT EXISTS operator_track_override (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  metadata_release_group_id UUID NOT NULL REFERENCES metadata_release_groups(id) ON DELETE CASCADE,
  metadata_release_id UUID NULL REFERENCES metadata_releases(id) ON DELETE SET NULL,
  recording_mbid UUID NULL,
  track_mbid UUID NULL,
  medium_position INTEGER NULL CHECK (medium_position IS NULL OR medium_position > 0),
  track_position INTEGER NULL CHECK (track_position IS NULL OR track_position > 0),
  track_title_snapshot TEXT NULL,
  track_length_ms_snapshot INTEGER NULL CHECK (
    track_length_ms_snapshot IS NULL OR track_length_ms_snapshot >= 0
  ),
  is_desired BOOLEAN NOT NULL,
  remap_status TEXT NOT NULL DEFAULT 'resolved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operator_track_override_identity_check CHECK (
    track_mbid IS NOT NULL
    OR (
      recording_mbid IS NOT NULL
      AND medium_position IS NOT NULL
      AND track_position IS NOT NULL
    )
  ),
  CONSTRAINT operator_track_override_remap_status_check CHECK (
    remap_status IN ('resolved', 'review_needed', 'orphaned')
  )
);

CREATE INDEX IF NOT EXISTS operator_track_override_artist_lookup_idx
  ON operator_track_override (app_user_id, metadata_artist_id, metadata_release_group_id);

CREATE INDEX IF NOT EXISTS operator_track_override_release_lookup_idx
  ON operator_track_override (metadata_release_group_id, metadata_release_id);

CREATE UNIQUE INDEX IF NOT EXISTS operator_track_override_track_mbid_unique
  ON operator_track_override (app_user_id, metadata_release_group_id, track_mbid)
  WHERE track_mbid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS operator_track_override_recording_fallback_unique
  ON operator_track_override (
    app_user_id,
    metadata_release_group_id,
    metadata_release_id,
    recording_mbid,
    medium_position,
    track_position
  )
  WHERE track_mbid IS NULL
    AND recording_mbid IS NOT NULL
    AND medium_position IS NOT NULL
    AND track_position IS NOT NULL;
