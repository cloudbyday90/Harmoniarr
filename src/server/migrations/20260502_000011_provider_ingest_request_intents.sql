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

CREATE TABLE IF NOT EXISTS provider_ingest_requests (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  media_request_id UUID NOT NULL REFERENCES media_requests(id) ON DELETE CASCADE,
  source_provider TEXT NOT NULL,
  source_resource_type TEXT NOT NULL,
  ingest_target_type TEXT NOT NULL,
  source_identifier TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  page_number INTEGER NOT NULL DEFAULT 1 CHECK (page_number > 0),
  page_cursor TEXT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT provider_ingest_requests_source_provider_check CHECK (source_provider IN ('spotify', 'youtube', 'apple_music')),
  CONSTRAINT provider_ingest_requests_source_resource_type_check CHECK (source_resource_type IN ('playlist', 'artist', 'release', 'track', 'video')),
  CONSTRAINT provider_ingest_requests_ingest_target_type_check CHECK (ingest_target_type IN ('playlist_page', 'artist', 'release', 'track', 'video')),
  CONSTRAINT provider_ingest_requests_status_check CHECK (status IN ('planned', 'processing', 'completed', 'failed', 'unsupported'))
);

CREATE INDEX IF NOT EXISTS provider_ingest_requests_media_request_idx
  ON provider_ingest_requests (media_request_id, created_at ASC);

CREATE INDEX IF NOT EXISTS provider_ingest_requests_status_idx
  ON provider_ingest_requests (status, source_provider, created_at ASC);