-- forward-only migration
-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
-- Licensed under GPL-3.0-or-later. See LICENSE.
BEGIN;

-- Never select/cancel recovery material implicitly during an upgrade.
DO $$
BEGIN
  IF (SELECT count(*) FROM admin_recovery_runs WHERE status = 'armed') > 1 THEN
    RAISE EXCEPTION USING ERRCODE = '23505',
      MESSAGE = 'Multiple armed recovery runs require operator review before the one-armed-run migration';
  END IF;
END;
$$;

CREATE UNIQUE INDEX admin_recovery_runs_one_armed_idx
  ON admin_recovery_runs (status) WHERE status = 'armed';

COMMIT;
