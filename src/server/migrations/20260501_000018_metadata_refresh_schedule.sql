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

ALTER TABLE metadata_artist_monitoring
  ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS next_refresh_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS metadata_artist_monitoring_due_refresh_idx
  ON metadata_artist_monitoring (is_monitored, next_refresh_at ASC, updated_at DESC);