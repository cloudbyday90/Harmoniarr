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

CREATE TABLE IF NOT EXISTS import_candidate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_candidate_id UUID NOT NULL REFERENCES import_candidates(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_status TEXT NULL,
  new_status TEXT NULL,
  reason TEXT NULL,
  actor_user_id UUID NULL REFERENCES app_users(id),
  details JSONB NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS import_candidate_events_candidate_idx
  ON import_candidate_events (import_candidate_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS import_candidate_events_type_occurred_idx
  ON import_candidate_events (event_type, occurred_at DESC);
