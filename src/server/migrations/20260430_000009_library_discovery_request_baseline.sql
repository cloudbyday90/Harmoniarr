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

CREATE TABLE IF NOT EXISTS library_discovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  metadata_release_group_id UUID NOT NULL REFERENCES metadata_release_groups(id) ON DELETE CASCADE,
  metadata_release_id UUID NOT NULL REFERENCES metadata_releases(id) ON DELETE CASCADE,
  wanted_status TEXT NOT NULL,
  search_mode TEXT NOT NULL DEFAULT 'automatic',
  request_status TEXT NOT NULL,
  blocked_reason TEXT NULL,
  release_date DATE NULL,
  last_search_at TIMESTAMPTZ NULL,
  next_search_after TIMESTAMPTZ NULL,
  manual_requested_at TIMESTAMPTZ NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metadata_release_id),
  CONSTRAINT library_discovery_requests_wanted_status_check CHECK (wanted_status IN ('missing', 'partial')),
  CONSTRAINT library_discovery_requests_search_mode_check CHECK (search_mode IN ('automatic', 'manual')),
  CONSTRAINT library_discovery_requests_status_check CHECK (request_status IN ('ready', 'cooldown', 'blocked'))
);

CREATE INDEX IF NOT EXISTS library_discovery_requests_status_idx
  ON library_discovery_requests (request_status, next_search_after ASC);

CREATE INDEX IF NOT EXISTS library_discovery_requests_artist_idx
  ON library_discovery_requests (metadata_artist_id, next_search_after ASC);