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
-- Splits metadata refresh cadence from legacy shared monitoring state. The
-- refresh heartbeat now derives monitored eligibility from operator monitoring
-- while this table stores one provider-refresh schedule per metadata artist.

BEGIN;

CREATE TABLE IF NOT EXISTS metadata_artist_refresh_state (
  metadata_artist_id UUID PRIMARY KEY REFERENCES metadata_artists(id) ON DELETE CASCADE,
  last_refreshed_at TIMESTAMPTZ NULL,
  next_refresh_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO metadata_artist_refresh_state (
  metadata_artist_id,
  last_refreshed_at,
  next_refresh_at,
  created_at,
  updated_at
)
SELECT
  metadata_artist_id,
  last_refreshed_at,
  next_refresh_at,
  NOW(),
  NOW()
FROM metadata_artist_monitoring
WHERE is_monitored = TRUE
   OR last_refreshed_at IS NOT NULL
   OR next_refresh_at IS NOT NULL
ON CONFLICT (metadata_artist_id) DO UPDATE
SET last_refreshed_at = EXCLUDED.last_refreshed_at,
    next_refresh_at = EXCLUDED.next_refresh_at,
    updated_at = NOW();

CREATE INDEX IF NOT EXISTS metadata_artist_refresh_state_due_idx
  ON metadata_artist_refresh_state (next_refresh_at ASC, updated_at DESC);

CREATE INDEX IF NOT EXISTS operator_artist_monitoring_refresh_eligibility_idx
  ON operator_artist_monitoring (metadata_artist_id, updated_at DESC)
  WHERE is_monitored = TRUE;

COMMIT;
