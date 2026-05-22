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

-- Append-only domain events for media request lifecycle tracking.
-- Follows the import_candidate_events pattern for consistency.
CREATE TABLE IF NOT EXISTS media_request_events (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  media_request_id UUID NOT NULL REFERENCES media_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_requested_for_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL,
  new_requested_for_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL,
  reason TEXT NULL,
  actor_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL,
  details JSONB NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_request_events_request_id
  ON media_request_events (media_request_id, occurred_at DESC);

CREATE INDEX idx_media_request_events_event_type
  ON media_request_events (event_type)
  WHERE event_type = 'reassigned';
