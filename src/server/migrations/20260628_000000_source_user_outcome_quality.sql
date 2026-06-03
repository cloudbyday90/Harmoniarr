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

-- Quality-weighted outcomes. A binary success/failure outcome cannot express a
-- partially-delivered acquisition (some files applied, transcode preflight
-- warnings, format mismatch, truncated transfer). quality_weight captures the
-- delivered fidelity of a *success* on a 0..1 scale: a clean apply is 1.0, a
-- half-applied folder is ~0.5. The recency-weighted reputation model splits a
-- success's decay weight into success/failure mass by quality_weight, so a peer
-- that consistently delivers degraded material is scored as partially
-- unreliable rather than fully trusted. quality_weight defaults to 1.0 so every
-- pre-existing row and every caller that does not supply quality keeps the
-- prior binary semantics (fully backward compatible).
ALTER TABLE source_user_outcome_events
  ADD COLUMN IF NOT EXISTS quality_weight NUMERIC(4, 3) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS quality_label TEXT;

ALTER TABLE source_user_outcome_events
  DROP CONSTRAINT IF EXISTS source_user_outcome_events_quality_weight_unit_interval;

ALTER TABLE source_user_outcome_events
  ADD CONSTRAINT source_user_outcome_events_quality_weight_unit_interval
  CHECK (quality_weight >= 0 AND quality_weight <= 1);

COMMIT;
