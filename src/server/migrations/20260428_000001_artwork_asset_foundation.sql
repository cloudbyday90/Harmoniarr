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

INSERT INTO path_contracts (key, path, description)
VALUES
  ('artwork', '/app/data/artwork', 'App-owned artwork originals, derivatives, extracted durable copies, and temporary processing workspace.')
ON CONFLICT (key) DO UPDATE
SET path = EXCLUDED.path,
    description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS artwork_assets (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  storage_namespace TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  width INTEGER NULL CHECK (width IS NULL OR width > 0),
  height INTEGER NULL CHECK (height IS NULL OR height > 0),
  storage_class TEXT NOT NULL,
  source_provider TEXT NULL,
  source_url TEXT NULL,
  payload_checksum TEXT NULL,
  fetched_at TIMESTAMPTZ NULL,
  last_verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (storage_namespace, relative_path),
  UNIQUE (sha256)
);

CREATE TABLE IF NOT EXISTS artwork_assignments (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  artwork_asset_id UUID NOT NULL REFERENCES artwork_assets(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  artwork_role TEXT NOT NULL,
  source_provider TEXT NULL,
  source_reference TEXT NULL,
  is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
  priority INTEGER NOT NULL DEFAULT 100,
  observed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_type, owner_id, artwork_role, artwork_asset_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS artwork_assignments_one_preferred_per_owner_role
  ON artwork_assignments (owner_type, owner_id, artwork_role)
  WHERE is_preferred = TRUE;

CREATE INDEX IF NOT EXISTS artwork_assignments_owner_lookup_idx
  ON artwork_assignments (owner_type, owner_id, priority ASC, created_at ASC);