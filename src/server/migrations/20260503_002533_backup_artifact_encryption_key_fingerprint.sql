-- forward-only migration
BEGIN;

ALTER TABLE backup_artifacts
  ADD COLUMN IF NOT EXISTS encryption_key_fingerprint TEXT NULL;

COMMIT;
