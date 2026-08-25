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

ALTER TABLE operator_release_group_selection
  ADD COLUMN selection_origin TEXT NULL;

ALTER TABLE operator_release_group_selection
  ADD CONSTRAINT operator_release_group_selection_origin_check CHECK (
    selection_origin IS NULL
    OR selection_origin IN ('manual_edition', 'manual_inclusion')
  );

ALTER TABLE operator_release_group_selection
  ADD CONSTRAINT operator_release_group_selection_origin_source_check CHECK (
    selection_origin IS NULL
    OR selection_source = 'manual'
  );

COMMIT;
