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

-- forward-only migration
BEGIN;

CREATE TABLE IF NOT EXISTS backup_artifact_file_operations (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  operation_type TEXT NOT NULL CHECK (operation_type IN ('publish', 'delete')),
  status TEXT NOT NULL DEFAULT 'prepared' CHECK (status IN (
    'prepared',
    'temporary_ready',
    'finalized',
    'awaiting_confirmation',
    'completed',
    'abandoned'
  )),
  backup_artifact_id UUID NULL REFERENCES backup_artifacts(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  temporary_path TEXT NULL,
  artifact_snapshot_json JSONB NOT NULL,
  expected_file_sha256 TEXT NOT NULL CHECK (expected_file_sha256 ~ '^[0-9a-f]{64}$'),
  expected_file_size_bytes BIGINT NOT NULL CHECK (expected_file_size_bytes >= 0),
  created_by_user_id UUID NULL REFERENCES app_users(id),
  last_error_code TEXT NULL,
  last_error_message TEXT NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_artifact_file_operations_recovery
  ON backup_artifact_file_operations (status, created_at ASC)
  WHERE status IN ('prepared', 'temporary_ready', 'finalized', 'awaiting_confirmation');

CREATE INDEX IF NOT EXISTS idx_backup_artifact_file_operations_artifact
  ON backup_artifact_file_operations (backup_artifact_id, created_at DESC);

COMMIT;
