/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

-- Add fan-out columns so a single admin request can materialise
-- durable target-owned request rows for multiple users.
ALTER TABLE media_requests
  ADD COLUMN fan_out_parent_id UUID NULL
    REFERENCES media_requests(id) ON DELETE CASCADE,
  ADD COLUMN fan_out_child_count INTEGER NOT NULL DEFAULT 0;

-- Index for looking up children of a parent request.
CREATE INDEX idx_media_requests_fan_out_parent_id
  ON media_requests (fan_out_parent_id)
  WHERE fan_out_parent_id IS NOT NULL;
