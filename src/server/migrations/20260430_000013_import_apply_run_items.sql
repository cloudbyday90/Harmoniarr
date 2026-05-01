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

CREATE TABLE IF NOT EXISTS import_apply_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_run_id UUID NOT NULL REFERENCES operation_runs(id) ON DELETE CASCADE,
  import_candidate_id UUID NOT NULL REFERENCES import_candidates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  item_status TEXT NOT NULL
    CHECK (item_status IN (
      'ready',
      'ready_with_warnings',
      'blocked',
      'applied',
      'applied_with_warnings',
      'apply_failed'
    )),
  status_message TEXT NOT NULL,
  apply_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (operation_run_id, import_candidate_id),
  UNIQUE (operation_run_id, position)
);

CREATE INDEX IF NOT EXISTS import_apply_run_items_run_idx
  ON import_apply_run_items (operation_run_id, position ASC);

CREATE INDEX IF NOT EXISTS import_apply_run_items_candidate_idx
  ON import_apply_run_items (import_candidate_id, created_at DESC);