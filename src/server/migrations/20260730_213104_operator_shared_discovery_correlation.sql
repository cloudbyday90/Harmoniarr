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

BEGIN;

-- A provider search remains shared by metadata release. This link preserves
-- every active operator's wanted-release projection without duplicating work.
CREATE TABLE IF NOT EXISTS library_discovery_request_wanted_release_links (
  discovery_request_id UUID NOT NULL REFERENCES library_discovery_requests(id) ON DELETE CASCADE,
  wanted_release_id UUID NOT NULL REFERENCES library_wanted_releases(id) ON DELETE CASCADE,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (discovery_request_id, wanted_release_id)
);

CREATE INDEX IF NOT EXISTS library_discovery_request_wanted_release_links_wanted_idx
  ON library_discovery_request_wanted_release_links (wanted_release_id, discovery_request_id);

INSERT INTO library_discovery_request_wanted_release_links (
  discovery_request_id,
  wanted_release_id
)
SELECT
  library_discovery_requests.id,
  library_wanted_releases.id
FROM library_discovery_requests
JOIN library_wanted_releases
  ON library_wanted_releases.metadata_release_id = library_discovery_requests.metadata_release_id
WHERE library_wanted_releases.wanted_status IN ('missing', 'partial')
ON CONFLICT (discovery_request_id, wanted_release_id) DO NOTHING;

COMMIT;
