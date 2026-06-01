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

ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS download_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selection_reason TEXT NULL;

ALTER TABLE import_candidates
  DROP CONSTRAINT IF EXISTS import_candidates_download_attempt_count_check;

ALTER TABLE import_candidates
  ADD CONSTRAINT import_candidates_download_attempt_count_check
  CHECK (download_attempt_count >= 0);
