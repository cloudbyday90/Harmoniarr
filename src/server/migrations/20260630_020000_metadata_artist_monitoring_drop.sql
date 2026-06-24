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
-- Drops the legacy metadata_artist_monitoring table. The operator-scoped
-- monitoring model (operator_artist_monitoring + metadata_artist_refresh_state)
-- is the sole source of truth; this table has zero code references after the
-- read, write, and backup/restore migrations. It has no foreign-key dependents.

BEGIN;

DROP TABLE IF EXISTS metadata_artist_monitoring;

COMMIT;
