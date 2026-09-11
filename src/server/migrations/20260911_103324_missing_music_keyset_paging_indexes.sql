-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.
-- Forward-only migration.
BEGIN;

CREATE INDEX library_wanted_releases_created_id_idx
  ON library_wanted_releases (created_at DESC, id DESC);
CREATE INDEX library_wanted_releases_user_created_id_idx
  ON library_wanted_releases (app_user_id, created_at DESC, id DESC);

COMMIT;
