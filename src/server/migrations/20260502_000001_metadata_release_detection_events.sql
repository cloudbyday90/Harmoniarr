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

CREATE TABLE IF NOT EXISTS metadata_release_detection_events (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  metadata_release_group_id UUID NOT NULL REFERENCES metadata_release_groups(id) ON DELETE CASCADE,
  musicbrainz_release_group_id TEXT NULL,
  provider TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  detection_type TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  monitoring_decision TEXT NOT NULL,
  resulting_wanted_status TEXT NULL,
  title TEXT NOT NULL,
  primary_type TEXT NULL,
  first_release_date DATE NULL,
  operation_run_id UUID NULL REFERENCES operation_runs(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS metadata_release_detection_events_artist_idx
  ON metadata_release_detection_events (metadata_artist_id, occurred_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS metadata_release_detection_events_run_idx
  ON metadata_release_detection_events (operation_run_id)
  WHERE operation_run_id IS NOT NULL;