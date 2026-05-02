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

CREATE TABLE IF NOT EXISTS library_file_matches (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  library_file_id UUID NOT NULL REFERENCES library_files(id) ON DELETE CASCADE,
  metadata_artist_id UUID NULL REFERENCES metadata_artists(id) ON DELETE SET NULL,
  metadata_release_group_id UUID NULL REFERENCES metadata_release_groups(id) ON DELETE SET NULL,
  metadata_release_id UUID NULL REFERENCES metadata_releases(id) ON DELETE SET NULL,
  metadata_medium_id UUID NULL REFERENCES metadata_media(id) ON DELETE SET NULL,
  metadata_track_id UUID NULL REFERENCES metadata_tracks(id) ON DELETE SET NULL,
  metadata_recording_id UUID NULL REFERENCES metadata_recordings(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL
    CHECK (match_status IN ('matched', 'ambiguous', 'unmatched')),
  confidence TEXT NOT NULL
    CHECK (confidence IN ('high', 'medium', 'low')),
  matched_by TEXT NOT NULL,
  evidence JSONB NULL,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (library_file_id)
);

CREATE INDEX IF NOT EXISTS library_file_matches_status_idx
  ON library_file_matches (match_status, matched_at DESC);

CREATE INDEX IF NOT EXISTS library_file_matches_release_idx
  ON library_file_matches (metadata_release_id, metadata_track_id, matched_at DESC)
  WHERE metadata_release_id IS NOT NULL;