-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
-- This program is free software: licensed under GPL-3.0-or-later.
-- See LICENSE for details.

-- forward-only migration
BEGIN;

-- Keep the surrogate row ID stable; this UUID identifies one acquisition only.
ALTER TABLE job_leases
  ADD COLUMN acquisition_id UUID NOT NULL DEFAULT gen_random_uuid();

COMMIT;
