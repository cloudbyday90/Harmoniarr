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

-- Admin recovery runs for emergency bootstrap-admin recovery

CREATE TABLE IF NOT EXISTS admin_recovery_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  status TEXT NOT NULL DEFAULT 'armed'
    CHECK (status IN ('armed', 'completed', 'cancelled', 'expired', 'invalidated')),
  recovery_code_hash TEXT NOT NULL,
  armed_via TEXT NOT NULL DEFAULT 'harmoniarrctl',
  armed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  invalid_attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_admin_user_id TEXT REFERENCES app_users(id),
  completed_from_ip TEXT,
  completed_user_agent TEXT,
  reason TEXT,
  details_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_recovery_runs_active
  ON admin_recovery_runs (status, expires_at)
  WHERE status = 'armed';
