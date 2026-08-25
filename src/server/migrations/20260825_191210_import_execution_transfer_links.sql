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

-- The child link must refer to the exact immutable execution item, run, and
-- candidate combination. The extra unique constraint is the composite target
-- required by PostgreSQL for that foreign key.
ALTER TABLE import_execution_run_items
  ADD CONSTRAINT import_execution_run_items_id_run_candidate_key
  UNIQUE (id, operation_run_id, import_candidate_id);

CREATE TABLE import_execution_transfer_links (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  import_execution_run_item_id UUID NOT NULL,
  operation_run_id UUID NOT NULL,
  import_candidate_id UUID NOT NULL,
  provider TEXT NOT NULL,
  source_username TEXT NOT NULL,
  provider_transfer_id TEXT NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT import_exec_transfer_link_item_fkey
    FOREIGN KEY (import_execution_run_item_id, operation_run_id, import_candidate_id)
    REFERENCES import_execution_run_items (id, operation_run_id, import_candidate_id)
    ON DELETE CASCADE,
  CONSTRAINT import_exec_transfer_link_provider_identity_key
    UNIQUE (provider, source_username, provider_transfer_id)
);

CREATE INDEX import_exec_transfer_link_item_idx
  ON import_execution_transfer_links (import_execution_run_item_id, linked_at DESC);

CREATE INDEX import_exec_transfer_link_candidate_idx
  ON import_execution_transfer_links (import_candidate_id, linked_at DESC);

COMMIT;
