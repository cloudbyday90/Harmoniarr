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

CREATE TABLE IF NOT EXISTS library_wanted_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  metadata_release_group_id UUID NOT NULL REFERENCES metadata_release_groups(id) ON DELETE CASCADE,
  metadata_release_id UUID NOT NULL REFERENCES metadata_releases(id) ON DELETE CASCADE,
  wanted_status TEXT NOT NULL,
  expected_track_count INTEGER NOT NULL,
  matched_track_count INTEGER NOT NULL,
  missing_track_count INTEGER NOT NULL,
  release_date DATE NULL,
  release_status TEXT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metadata_release_id),
  CONSTRAINT library_wanted_releases_status_check CHECK (wanted_status IN ('missing', 'partial')),
  CONSTRAINT library_wanted_releases_track_counts_check CHECK (
    expected_track_count >= 0
    AND matched_track_count >= 0
    AND missing_track_count >= 0
    AND matched_track_count <= expected_track_count
    AND missing_track_count <= expected_track_count
  )
);

CREATE INDEX IF NOT EXISTS library_wanted_releases_status_idx
  ON library_wanted_releases (wanted_status, last_reconciled_at DESC);

CREATE INDEX IF NOT EXISTS library_wanted_releases_artist_idx
  ON library_wanted_releases (metadata_artist_id, last_reconciled_at DESC);