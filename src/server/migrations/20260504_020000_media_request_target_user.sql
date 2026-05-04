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

ALTER TABLE media_requests
  ADD COLUMN IF NOT EXISTS requested_for_user_id UUID NULL REFERENCES app_users(id) ON DELETE CASCADE;

UPDATE media_requests
SET requested_for_user_id = requested_by_user_id
WHERE requested_for_user_id IS NULL;

ALTER TABLE media_requests
  ALTER COLUMN requested_for_user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS media_requests_requested_for_user_created_at_idx
  ON media_requests (requested_for_user_id, created_at DESC);