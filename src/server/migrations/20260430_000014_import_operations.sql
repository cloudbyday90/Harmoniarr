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

CREATE TABLE IF NOT EXISTS import_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_run_id UUID NOT NULL REFERENCES operation_runs(id) ON DELETE CASCADE,
  import_candidate_id UUID NOT NULL REFERENCES import_candidates(id) ON DELETE CASCADE,
  import_candidate_file_id UUID NOT NULL REFERENCES import_candidate_files(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  step_type TEXT NOT NULL
    CHECK (step_type IN ('stage', 'finalize')),
  operation_type TEXT NOT NULL
    CHECK (operation_type IN ('move', 'copy', 'hardlink')),
  transport TEXT NULL,
  source_path TEXT NOT NULL,
  destination_path TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('applied', 'failed', 'not_attempted')),
  error_message TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (operation_run_id, position),
  UNIQUE (operation_run_id, import_candidate_file_id, step_type)
);

CREATE INDEX IF NOT EXISTS import_operations_run_idx
  ON import_operations (operation_run_id, position ASC);

CREATE INDEX IF NOT EXISTS import_operations_candidate_file_idx
  ON import_operations (import_candidate_file_id, created_at DESC);

CREATE INDEX IF NOT EXISTS import_operations_candidate_idx
  ON import_operations (import_candidate_id, created_at DESC);