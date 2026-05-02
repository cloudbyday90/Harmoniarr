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

CREATE TABLE IF NOT EXISTS metadata_artist_monitoring (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  is_monitored BOOLEAN NOT NULL DEFAULT FALSE,
  monitored_release_group_types TEXT[] NOT NULL DEFAULT ARRAY['album', 'ep']::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metadata_artist_id)
);

CREATE INDEX IF NOT EXISTS metadata_artist_monitoring_monitored_idx
  ON metadata_artist_monitoring (is_monitored, updated_at DESC);