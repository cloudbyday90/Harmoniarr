-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

BEGIN;

ALTER TABLE user_push_subscriptions
  ADD COLUMN registration_token UUID NOT NULL DEFAULT harmoniarr_generate_uuid();

COMMIT;
