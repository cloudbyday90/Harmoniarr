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

-- Append-only ledger of per-source-user delivery outcomes (success/failure).
-- Each acquisition outcome is recorded as an immutable INSERT, which is
-- inherently concurrency-safe (no read-modify-write), unlike the
-- recovery_trust_snapshots blob that rewrites every row per outcome. This
-- ledger is the durable evidence source for recency-weighted reputation
-- (exponential time-decay + Wilson score lower bound) and explainable
-- auto-ignore suggestions. The blob remains the operator-facing trust state
-- (manual overrides / blocklist) and is unaffected by this table.
CREATE TABLE IF NOT EXISTS source_user_outcome_events (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  username_key TEXT NOT NULL,
  username TEXT NOT NULL,
  outcome TEXT NOT NULL,
  event_type TEXT,
  reason TEXT,
  actor_user_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT source_user_outcome_events_username_key_not_blank CHECK (length(btrim(username_key)) > 0),
  CONSTRAINT source_user_outcome_events_username_not_blank CHECK (length(btrim(username)) > 0),
  CONSTRAINT source_user_outcome_events_outcome_valid CHECK (outcome IN ('success', 'failure'))
);

CREATE INDEX IF NOT EXISTS idx_source_user_outcome_events_username_key_occurred_at
  ON source_user_outcome_events (username_key, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_user_outcome_events_occurred_at
  ON source_user_outcome_events (occurred_at);

COMMIT;
