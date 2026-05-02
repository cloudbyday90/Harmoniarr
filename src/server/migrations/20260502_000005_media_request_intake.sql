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

CREATE TABLE IF NOT EXISTS media_requests (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  requested_by_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  request_kind TEXT NOT NULL,
  request_state TEXT NOT NULL,
  artist_name TEXT NULL,
  release_title TEXT NULL,
  track_title TEXT NULL,
  source_url TEXT NULL,
  source_provider TEXT NULL,
  normalized_query TEXT NOT NULL,
  matched_metadata_release_group_id UUID NULL REFERENCES metadata_release_groups(id) ON DELETE SET NULL,
  matched_metadata_release_id UUID NULL REFERENCES metadata_releases(id) ON DELETE SET NULL,
  notes TEXT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_requests_kind_check CHECK (request_kind IN ('release', 'track', 'external_url')),
  CONSTRAINT media_requests_state_check CHECK (request_state IN ('already_exists', 'needs_fetch', 'needs_review')),
  CONSTRAINT media_requests_payload_check CHECK (
    (request_kind = 'release' AND artist_name IS NOT NULL AND release_title IS NOT NULL AND track_title IS NULL)
    OR (request_kind = 'track' AND artist_name IS NOT NULL AND track_title IS NOT NULL)
    OR (request_kind = 'external_url' AND source_url IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS media_requests_requested_by_user_created_at_idx
  ON media_requests (requested_by_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS media_requests_state_created_at_idx
  ON media_requests (request_state, created_at DESC);