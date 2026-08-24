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

-- forward-only migration
BEGIN;

-- Use DEFAULT harmoniarr_generate_uuid() for UUID surrogate primary keys.

ALTER TABLE control_plane_idempotency_records
  ADD COLUMN state TEXT NOT NULL DEFAULT 'completed'
    CONSTRAINT control_plane_idempotency_records_state_check
      CHECK (state IN ('in_progress', 'completed'));

-- The original unique constraint treats a NULL actor as distinct. Webhook
-- mutations have no actor, so retain one deterministic record before making
-- that key space unique. Idempotency records are an expiring replay cache;
-- the newest response is the useful one to preserve.
WITH ranked_records AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY operation_scope, actor_user_id, idempotency_key
      ORDER BY created_at DESC, id DESC
    ) AS duplicate_rank
  FROM control_plane_idempotency_records
)
DELETE FROM control_plane_idempotency_records AS record
USING ranked_records
WHERE record.id = ranked_records.id
  AND ranked_records.duplicate_rank > 1;

ALTER TABLE control_plane_idempotency_records
  DROP CONSTRAINT control_plane_idempotency_rec_operation_scope_actor_user_id_key;

ALTER TABLE control_plane_idempotency_records
  ADD CONSTRAINT control_plane_idempotency_records_scope_actor_key_unique
    UNIQUE NULLS NOT DISTINCT (operation_scope, actor_user_id, idempotency_key);

COMMIT;
