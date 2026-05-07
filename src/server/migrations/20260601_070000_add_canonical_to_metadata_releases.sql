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

-- Add is_canonical flag to metadata_releases.
--
-- At most one release per release group may have is_canonical = TRUE. This is
-- enforced by a partial unique index so the constraint is only applied to the
-- true value, leaving all other releases defaulting to FALSE without conflict.
--
-- The canonical release is selected by backfillCanonicalReleases() at startup
-- and can be overridden by the PATCH /api/v1/metadata/releases/:id/canonical
-- endpoint. The tracklist endpoint uses the canonical release as the default
-- edition when no preference is specified.

ALTER TABLE metadata_releases
  ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS metadata_releases_one_canonical_per_group_idx
  ON metadata_releases (metadata_release_group_id)
  WHERE is_canonical = TRUE;
