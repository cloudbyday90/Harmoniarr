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

CREATE TABLE IF NOT EXISTS library_roots (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  canonical_path TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quality_profile_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS library_roots_enabled_idx
  ON library_roots (is_enabled, updated_at DESC);

CREATE TABLE IF NOT EXISTS library_files (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  library_root_id UUID NOT NULL REFERENCES library_roots(id) ON DELETE CASCADE,
  canonical_path TEXT NOT NULL UNIQUE,
  relative_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  extension TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  modified_at TIMESTAMPTZ NULL,
  audio_codec TEXT NULL,
  bitrate_kbps INTEGER NULL CHECK (bitrate_kbps IS NULL OR bitrate_kbps >= 0),
  sample_rate_hz INTEGER NULL CHECK (sample_rate_hz IS NULL OR sample_rate_hz >= 0),
  bit_depth INTEGER NULL CHECK (bit_depth IS NULL OR bit_depth >= 0),
  channels INTEGER NULL CHECK (channels IS NULL OR channels >= 0),
  duration_ms INTEGER NULL CHECK (duration_ms IS NULL OR duration_ms >= 0),
  tag_payload JSONB NULL,
  file_state TEXT NOT NULL DEFAULT 'observed'
    CHECK (file_state IN ('observed', 'ignored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS library_files_root_state_idx
  ON library_files (library_root_id, file_state, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS library_files_root_relative_idx
  ON library_files (library_root_id, relative_path)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS library_files_deleted_idx
  ON library_files (library_root_id, deleted_at DESC);