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

CREATE TABLE IF NOT EXISTS import_candidate_file_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_candidate_id UUID NOT NULL REFERENCES import_candidates(id) ON DELETE CASCADE,
  import_candidate_file_id UUID NOT NULL REFERENCES import_candidate_files(id) ON DELETE CASCADE,
  decision_type TEXT NOT NULL
    CHECK (decision_type IN ('skip')),
  reason TEXT NULL,
  actor_user_id UUID NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (import_candidate_file_id)
);

CREATE INDEX IF NOT EXISTS import_candidate_file_decisions_candidate_idx
  ON import_candidate_file_decisions (import_candidate_id, updated_at DESC);

ALTER TABLE import_operations
  DROP CONSTRAINT IF EXISTS import_operations_status_check;

ALTER TABLE import_operations
  ADD CONSTRAINT import_operations_status_check
  CHECK (status IN ('applied', 'failed', 'not_attempted', 'skipped'));