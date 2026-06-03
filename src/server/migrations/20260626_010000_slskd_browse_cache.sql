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

-- Caches slskd per-folder browse responses so plausibility-gated browse passes
-- during library discovery do not repeatedly hammer the same remote peer folder.
-- Keyed by (username, directory); observed_at drives TTL freshness decisions.
CREATE TABLE IF NOT EXISTS slskd_browse_cache (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  username TEXT NOT NULL,
  directory TEXT NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT slskd_browse_cache_username_not_blank CHECK (length(btrim(username)) > 0),
  CONSTRAINT slskd_browse_cache_directory_not_blank CHECK (length(btrim(directory)) > 0),
  CONSTRAINT slskd_browse_cache_file_count_non_negative CHECK (file_count >= 0),
  CONSTRAINT slskd_browse_cache_username_directory_unique UNIQUE (username, directory)
);

CREATE INDEX IF NOT EXISTS idx_slskd_browse_cache_observed_at
  ON slskd_browse_cache (observed_at);

COMMIT;
