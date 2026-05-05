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

ALTER TABLE IF EXISTS admin_recovery_runs
  ADD COLUMN IF NOT EXISTS reason TEXT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_recovery_runs'
      AND column_name = 'details'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_recovery_runs'
      AND column_name = 'details_json'
  ) THEN
    EXECUTE 'ALTER TABLE admin_recovery_runs RENAME COLUMN details TO details_json';
  END IF;
END $$;

ALTER TABLE IF EXISTS admin_recovery_runs
  ADD COLUMN IF NOT EXISTS details_json JSONB NULL;

ALTER TABLE IF EXISTS admin_recovery_runs
  ALTER COLUMN status SET DEFAULT 'armed',
  ALTER COLUMN armed_via SET DEFAULT 'harmoniarrctl',
  ALTER COLUMN armed_at SET DEFAULT NOW();