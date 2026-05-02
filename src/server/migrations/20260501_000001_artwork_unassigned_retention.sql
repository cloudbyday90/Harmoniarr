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

ALTER TABLE artwork_assets
  ADD COLUMN IF NOT EXISTS unassigned_at TIMESTAMPTZ NULL;

ALTER TABLE artwork_assets
  ALTER COLUMN unassigned_at SET DEFAULT NOW();

UPDATE artwork_assets AS assets
SET unassigned_at = CASE
      WHEN EXISTS (
        SELECT 1
        FROM artwork_assignments AS assignments
        WHERE assignments.artwork_asset_id = assets.id
      ) THEN NULL
      ELSE NOW()
    END
WHERE assets.unassigned_at IS NULL;

CREATE INDEX IF NOT EXISTS artwork_assets_unassigned_cleanup_idx
  ON artwork_assets (unassigned_at ASC, created_at ASC, id ASC)
  WHERE unassigned_at IS NOT NULL;