-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
-- Licensed under GPL-3.0-or-later. See LICENSE for details.
-- forward-only migration
BEGIN;

ALTER TABLE operator_track_receipts
  ADD COLUMN IF NOT EXISTS receipt_revision_id UUID NOT NULL DEFAULT harmoniarr_generate_uuid(),
  ADD COLUMN IF NOT EXISTS library_path TEXT GENERATED ALWAYS AS (receipt #>> '{files,0,libraryPath}') STORED;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='operator_track_receipts'::regclass
    AND conname='operator_track_receipts_revision_unique') THEN
    ALTER TABLE operator_track_receipts ADD CONSTRAINT operator_track_receipts_revision_unique
      UNIQUE(import_candidate_id,app_user_id,receipt_revision_id);
  END IF;
END $$;

-- Case folding selects a superset on case-sensitive hosts. Service containment
-- still checks actual host semantics; this index is lookup, never authorization.
CREATE INDEX IF NOT EXISTS operator_track_receipts_scan_path_idx
  ON operator_track_receipts (lower(replace(library_path,chr(92),'/')) text_pattern_ops);

CREATE TABLE IF NOT EXISTS operator_track_receipt_invalidations (
  import_candidate_id UUID NOT NULL,
  app_user_id UUID NOT NULL,
  receipt_revision_id UUID NOT NULL,
  library_root_id UUID NOT NULL REFERENCES library_roots(id) ON DELETE CASCADE,
  scan_run_id UUID NULL REFERENCES operation_runs(id) ON DELETE SET NULL,
  scan_acquisition_id UUID NOT NULL,
  library_path TEXT NOT NULL CHECK (length(library_path)>0),
  disposition TEXT NOT NULL DEFAULT 'missing' CHECK (disposition='missing'),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT operator_track_receipt_invalidations_pkey PRIMARY KEY(import_candidate_id,app_user_id),
  CONSTRAINT operator_track_receipt_invalidations_revision_fkey
    FOREIGN KEY(import_candidate_id,app_user_id,receipt_revision_id)
    REFERENCES operator_track_receipts(import_candidate_id,app_user_id,receipt_revision_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS operator_track_receipt_invalidations_scan_idx ON operator_track_receipt_invalidations(scan_run_id);

COMMIT;
