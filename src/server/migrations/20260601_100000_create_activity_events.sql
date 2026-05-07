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

-- Append-only household activity log. Never updated; only inserted and (eventually)
-- pruned by a background task after a configurable retention window (default: 90 days).
--
-- Each row captures a single user-visible household event: a music request being
-- submitted, an artist being monitored, a download completing, etc. The feed endpoint
-- reads from this table to serve the household activity stream.
--
-- actor_user_id is nullable (ON DELETE SET NULL) so events survive user deletion.
-- entity_* columns are denormalized for display; they survive entity deletion.
CREATE TABLE IF NOT EXISTS activity_events (
  id               UUID         PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  event_type       TEXT         NOT NULL
                   CHECK (event_type IN (
                     'request_created',
                     'download_completed',
                     'release_added',
                     'artist_monitored',
                     'request_fulfilled'
                   )),
  actor_user_id    UUID         NULL REFERENCES app_users(id) ON DELETE SET NULL,
  entity_type      TEXT         NULL,   -- 'release', 'artist', 'media_request'
  entity_id        UUID         NULL,   -- FK to the entity; not enforced at DB level (polymorphic)
  entity_title     TEXT         NULL,   -- denormalized display name; survives entity deletion
  entity_artist    TEXT         NULL,   -- denormalized artist name for release events
  extra_payload    JSONB        NULL,   -- event-specific supplemental data
  occurred_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Primary feed read: most recent N events, optionally filtered by event_type.
CREATE INDEX IF NOT EXISTS activity_events_occurred_at_desc_idx
  ON activity_events (occurred_at DESC);

-- Per-user filtering on the operator Activity view.
CREATE INDEX IF NOT EXISTS activity_events_actor_occurred_at_idx
  ON activity_events (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;

-- Event-type filtering with date range.
CREATE INDEX IF NOT EXISTS activity_events_type_occurred_at_idx
  ON activity_events (event_type, occurred_at DESC);
