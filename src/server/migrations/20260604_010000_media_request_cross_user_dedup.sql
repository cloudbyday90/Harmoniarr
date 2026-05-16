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

-- Cross-user deduplication: link duplicate requests for the same release to a
-- single download job. musicbrainz_release_id enables exact MBID-based matching
-- without JOINing to metadata_releases. linked_request_id points to the primary
-- (first) request for this release; the linked request shares the same download.

ALTER TABLE media_requests
  ADD COLUMN IF NOT EXISTS musicbrainz_release_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS linked_request_id      UUID NULL REFERENCES media_requests(id) ON DELETE SET NULL;

-- Supports exact dedup lookup by MusicBrainz release MBID.
CREATE INDEX IF NOT EXISTS media_requests_musicbrainz_release_id_idx
  ON media_requests (musicbrainz_release_id)
  WHERE musicbrainz_release_id IS NOT NULL;

-- Prevents the same user from being linked to the same primary request twice
-- (rapid double-submit guard).
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_requests_linked_per_user
  ON media_requests (linked_request_id, requested_for_user_id)
  WHERE linked_request_id IS NOT NULL;
