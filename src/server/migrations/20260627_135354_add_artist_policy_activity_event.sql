--
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

ALTER TABLE activity_events
  DROP CONSTRAINT IF EXISTS activity_events_event_type_check;

ALTER TABLE activity_events
  ADD CONSTRAINT activity_events_event_type_check
  CHECK (event_type IN (
    'request_created',
    'download_completed',
    'release_added',
    'artist_monitored',
    'artist_policy_saved',
    'request_fulfilled'
  ));

COMMIT;
