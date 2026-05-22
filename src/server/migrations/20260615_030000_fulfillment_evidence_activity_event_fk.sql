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

-- Add deferred FK from fulfillment_evidence to activity_events.
-- The original migration (20260522) creates the column without the FK constraint
-- because activity_events does not exist until 20260601. The snapshot generator
-- concatenates migrations in timestamp order, so inline FK references to tables
-- created by later migrations cause the snapshot to fail on empty databases.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fulfillment_evidence_matched_activity_event_id_fkey'
  ) THEN
    ALTER TABLE fulfillment_evidence
      ADD CONSTRAINT fulfillment_evidence_matched_activity_event_id_fkey
      FOREIGN KEY (matched_activity_event_id) REFERENCES activity_events(id) ON DELETE SET NULL;
  END IF;
END$$;
