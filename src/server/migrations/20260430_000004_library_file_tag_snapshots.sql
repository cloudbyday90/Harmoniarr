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

CREATE TABLE IF NOT EXISTS file_tag_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_file_id UUID NOT NULL REFERENCES library_files(id) ON DELETE CASCADE,
  extractor TEXT NOT NULL,
  extractor_version TEXT NULL,
  tag_format TEXT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('extracted', 'failed')),
  embedded_artwork_count INTEGER NULL
    CHECK (embedded_artwork_count IS NULL OR embedded_artwork_count >= 0),
  raw_tags JSONB NULL,
  normalized_tags JSONB NULL,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS file_tag_snapshots_library_file_idx
  ON file_tag_snapshots (library_file_id, extracted_at DESC);

CREATE INDEX IF NOT EXISTS file_tag_snapshots_status_idx
  ON file_tag_snapshots (status, extracted_at DESC);