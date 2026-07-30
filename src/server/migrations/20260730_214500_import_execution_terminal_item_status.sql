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

-- Execution items begin as queue-planning rows, then reconciliation persists
-- the current provider outcome. The original constraint only admitted the
-- queue-planning vocabulary, leaving completed transfers durably marked queued.
ALTER TABLE import_execution_run_items
  DROP CONSTRAINT IF EXISTS import_execution_run_items_item_status_check;

ALTER TABLE import_execution_run_items
  ADD CONSTRAINT import_execution_run_items_item_status_check
  CHECK (item_status IN (
    'ready',
    'ready_with_warnings',
    'blocked',
    'queued',
    'queued_with_warnings',
    'queue_failed',
    'downloading',
    'completed',
    'failed',
    'rejected',
    'missing'
  ));

-- Repair rows that already hold a bounded persisted provider observation.
-- Rows without a known observation retain their existing planning status.
UPDATE import_execution_run_items
SET item_status = CASE planning_snapshot #>> '{execution,latestTransferSnapshot,summary,status}'
  WHEN 'active' THEN 'downloading'
  WHEN 'completed' THEN 'completed'
  WHEN 'failed' THEN 'failed'
  WHEN 'rejected' THEN 'rejected'
  WHEN 'not_found' THEN 'missing'
  ELSE item_status
END,
updated_at = NOW()
WHERE planning_snapshot #>> '{execution,latestTransferSnapshot,summary,status}' IN (
  'active',
  'completed',
  'failed',
  'rejected',
  'not_found'
);

COMMIT;
