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

CREATE TABLE IF NOT EXISTS backup_artifacts (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  filename TEXT NOT NULL UNIQUE,
  backup_type TEXT NOT NULL,
  encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  format_version TEXT NOT NULL,
  app_version TEXT NULL,
  migration_level TEXT NULL,
  scope_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload_sha256 TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  created_by_user_id UUID NULL REFERENCES app_users(id),
  storage_path TEXT NOT NULL,
  manifest_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_artifacts_created_at
  ON backup_artifacts (created_at DESC);
