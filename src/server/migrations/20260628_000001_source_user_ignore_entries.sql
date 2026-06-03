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

-- Operator-controlled ignore list for source users. This is the durable
-- "act" half of the learn->act loop: the reputation model (append-only outcome
-- ledger + Wilson lower bound) produces an explainable auto-ignore *suggestion*,
-- and this table records the *decision* to act on it. Entries here are read at
-- candidate-ingest time and fed into the G6 candidate source filter's
-- ignoredUsernames set, so an ignored peer's responses are dropped before any
-- import candidate is built.
--
-- A dedicated table (rather than a flag on recovery_trust_snapshots) is used
-- deliberately: the trust snapshot is backup/restore-scoped and rewritten as a
-- blob per outcome, whereas the ignore list is small operator configuration
-- with one row per ignored peer (UNIQUE username_key), upserted idempotently and
-- free of read-modify-write races.
CREATE TABLE IF NOT EXISTS source_user_ignore_entries (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  username_key TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  -- 'manual'         : an operator applied the ignore (one-click suggestion or direct).
  -- 'auto_suggested' : the opt-in auto-apply policy applied a confident suggestion.
  source TEXT NOT NULL DEFAULT 'manual',
  reason TEXT,
  actor_user_id TEXT,
  -- Snapshot of the reputation signals that justified an auto-apply (audit trail).
  suggestion_signals JSONB,
  -- Last time the auto-apply policy evaluated this peer; drives the cooldown that
  -- prevents the loop from churning/flapping on every new outcome event.
  last_auto_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT source_user_ignore_entries_username_key_not_blank CHECK (length(btrim(username_key)) > 0),
  CONSTRAINT source_user_ignore_entries_username_not_blank CHECK (length(btrim(username)) > 0),
  CONSTRAINT source_user_ignore_entries_source_valid CHECK (source IN ('manual', 'auto_suggested'))
);

CREATE INDEX IF NOT EXISTS idx_source_user_ignore_entries_created_at
  ON source_user_ignore_entries (created_at);

COMMIT;
