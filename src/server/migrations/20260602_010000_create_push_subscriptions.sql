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

-- Web Push subscription store. Each row represents a single browser or device
-- that has granted push permission and provided a PushSubscription object.
--
-- A user may have multiple active subscriptions (different browsers/devices).
-- The (user_id, endpoint) pair is unique so that re-subscribing from the same
-- browser/device is idempotent via upsert.
--
-- When the push service returns 404 or 410 for an endpoint the server removes
-- that row automatically ("auto-cleanup on expired subscription").
--
-- user_id is nullable on delete set null so orphan rows can be detected and
-- pruned rather than silently lost on user deletion.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID          PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  user_id      UUID          REFERENCES app_users(id) ON DELETE SET NULL,
  endpoint     TEXT          NOT NULL,
  p256dh       TEXT          NOT NULL,
  auth         TEXT          NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON push_subscriptions (user_id)
  WHERE user_id IS NOT NULL;
