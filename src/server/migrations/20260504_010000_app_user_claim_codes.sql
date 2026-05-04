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

CREATE TABLE IF NOT EXISTS app_user_claim_codes (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  issued_by_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL,
  claim_code_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  revoke_reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS app_user_claim_codes_active_user_idx
  ON app_user_claim_codes (app_user_id, created_at DESC)
  WHERE consumed_at IS NULL
    AND revoked_at IS NULL;