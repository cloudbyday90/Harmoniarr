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

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS metadata_artists_name_trgm_idx
  ON metadata_artists USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS metadata_artists_sort_name_trgm_idx
  ON metadata_artists USING GIN (sort_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS metadata_release_groups_title_trgm_idx
  ON metadata_release_groups USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS metadata_releases_title_trgm_idx
  ON metadata_releases USING GIN (title gin_trgm_ops);