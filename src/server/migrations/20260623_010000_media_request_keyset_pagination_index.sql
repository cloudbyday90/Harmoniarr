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

-- Composite index for keyset (cursor-based) pagination on media_requests.
--
-- The cursor-based listMediaRequests query uses row-value comparison:
--   WHERE (created_at, id) < ($N, $N)
--   ORDER BY created_at DESC, id DESC
--
-- Without a matching composite index the planner falls back to a sequential
-- scan with an external sort.  With this index it can perform a backward
-- index scan that satisfies both the filter and the ORDER BY in a single
-- pass, giving O(log n) page lookups at any depth.

CREATE INDEX IF NOT EXISTS idx_media_requests_created_at_id_desc
  ON media_requests (created_at DESC, id DESC);
