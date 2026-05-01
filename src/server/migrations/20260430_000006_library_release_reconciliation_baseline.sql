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

CREATE TABLE IF NOT EXISTS library_release_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  metadata_release_group_id UUID NOT NULL REFERENCES metadata_release_groups(id) ON DELETE CASCADE,
  metadata_release_id UUID NOT NULL REFERENCES metadata_releases(id) ON DELETE CASCADE,
  reconciliation_status TEXT NOT NULL
    CHECK (reconciliation_status IN ('complete', 'partial', 'duplicate')),
  expected_track_count INTEGER NOT NULL CHECK (expected_track_count >= 0),
  matched_track_count INTEGER NOT NULL CHECK (matched_track_count >= 0),
  missing_track_count INTEGER NOT NULL CHECK (missing_track_count >= 0),
  matched_file_count INTEGER NOT NULL CHECK (matched_file_count >= 0),
  duplicate_track_count INTEGER NOT NULL CHECK (duplicate_track_count >= 0),
  evidence JSONB NULL,
  last_reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metadata_release_id)
);

CREATE INDEX IF NOT EXISTS library_release_reconciliations_status_idx
  ON library_release_reconciliations (reconciliation_status, last_reconciled_at DESC);

CREATE INDEX IF NOT EXISTS library_release_reconciliations_artist_idx
  ON library_release_reconciliations (metadata_artist_id, metadata_release_group_id, last_reconciled_at DESC);