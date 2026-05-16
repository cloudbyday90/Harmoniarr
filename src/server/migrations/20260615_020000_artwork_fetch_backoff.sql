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

CREATE TABLE IF NOT EXISTS artwork_fetch_failures (
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  artwork_role TEXT NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  last_failed_at TIMESTAMPTZ NOT NULL,
  next_retry_at TIMESTAMPTZ NOT NULL,
  last_failure_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_type, owner_id, artwork_role)
);

CREATE INDEX IF NOT EXISTS artwork_fetch_failures_next_retry_idx
  ON artwork_fetch_failures (next_retry_at ASC);
