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

CREATE TABLE IF NOT EXISTS import_candidates (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  source_provider TEXT NOT NULL,
  source_search_id TEXT NOT NULL,
  source_response_key TEXT NOT NULL,
  username TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  candidate_type TEXT NOT NULL DEFAULT 'manual_search',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'held', 'rejected', 'selected', 'applied', 'failed')),
  file_count INTEGER NOT NULL DEFAULT 0 CHECK (file_count >= 0),
  locked_file_count INTEGER NOT NULL DEFAULT 0 CHECK (locked_file_count >= 0),
  total_size_bytes BIGINT NULL CHECK (total_size_bytes IS NULL OR total_size_bytes >= 0),
  raw_payload JSONB NOT NULL,
  normalized_payload JSONB NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_provider, source_search_id, source_response_key)
);

CREATE INDEX IF NOT EXISTS import_candidates_status_discovered_idx
  ON import_candidates (status, discovered_at DESC);

CREATE INDEX IF NOT EXISTS import_candidates_source_search_idx
  ON import_candidates (source_provider, source_search_id, discovered_at DESC);

CREATE INDEX IF NOT EXISTS import_candidates_username_folder_idx
  ON import_candidates (username, folder_path);

CREATE INDEX IF NOT EXISTS import_candidates_normalized_payload_gin_idx
  ON import_candidates USING GIN (normalized_payload jsonb_path_ops);

CREATE TABLE IF NOT EXISTS import_candidate_files (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  import_candidate_id UUID NOT NULL REFERENCES import_candidates(id) ON DELETE CASCADE,
  source_file_index INTEGER NOT NULL CHECK (source_file_index >= 0),
  filename TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  extension TEXT NULL,
  size_bytes BIGINT NULL CHECK (size_bytes IS NULL OR size_bytes >= 0),
  bit_rate_kbps INTEGER NULL CHECK (bit_rate_kbps IS NULL OR bit_rate_kbps >= 0),
  bit_depth INTEGER NULL CHECK (bit_depth IS NULL OR bit_depth >= 0),
  length_seconds INTEGER NULL CHECK (length_seconds IS NULL OR length_seconds >= 0),
  sample_rate_hz INTEGER NULL CHECK (sample_rate_hz IS NULL OR sample_rate_hz >= 0),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  raw_payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (import_candidate_id, source_file_index)
);

CREATE INDEX IF NOT EXISTS import_candidate_files_candidate_idx
  ON import_candidate_files (import_candidate_id, source_file_index);

CREATE INDEX IF NOT EXISTS import_candidate_files_extension_idx
  ON import_candidate_files (extension)
  WHERE extension IS NOT NULL;
