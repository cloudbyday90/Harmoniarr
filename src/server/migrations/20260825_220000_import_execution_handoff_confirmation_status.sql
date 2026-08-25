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

-- The durable handoff checkpoint prevents duplicate slskd enqueue requests
-- while confirmation is pending. It is written by the production execution
-- worker and reconciliation service, so it must be admitted by the execution
-- run-item constraint as well as by the application-level status model.
ALTER TABLE import_execution_run_items
  DROP CONSTRAINT IF EXISTS import_execution_run_items_item_status_check;

ALTER TABLE import_execution_run_items
  ADD CONSTRAINT import_execution_run_items_item_status_check
  CHECK (item_status IN (
    'ready',
    'ready_with_warnings',
    'blocked',
    'awaiting_confirmation',
    'queued',
    'queued_with_warnings',
    'queue_failed',
    'downloading',
    'completed',
    'failed',
    'rejected',
    'missing'
  ));

COMMIT;
