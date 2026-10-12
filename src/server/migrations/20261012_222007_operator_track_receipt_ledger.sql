-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
-- Licensed under GPL-3.0-or-later. See LICENSE for details.
-- forward-only migration
BEGIN;

-- Historical projection only. No current availability or recipient consent is
-- inferred from a stored receipt. Candidate JSON remains the canonical source.
CREATE TABLE IF NOT EXISTS operator_track_receipts (
  import_candidate_id UUID NOT NULL REFERENCES import_candidates(id) ON DELETE CASCADE,
  app_user_id UUID NOT NULL,
  metadata_release_id UUID NOT NULL,
  receipt JSONB NOT NULL,
  CONSTRAINT operator_track_receipts_pkey PRIMARY KEY (import_candidate_id, app_user_id),
  CONSTRAINT operator_track_receipts_binding_check CHECK ((
    jsonb_typeof(receipt) = 'object'
    AND receipt->'version' = '1'::jsonb
    AND receipt->>'ownerId' = app_user_id::text
    AND receipt #>> '{scope,metadataReleaseId}' = metadata_release_id::text
  ) IS TRUE)
);
CREATE INDEX IF NOT EXISTS operator_track_receipts_owner_release_idx
  ON operator_track_receipts (app_user_id, metadata_release_id, import_candidate_id);

-- One extraction contract for backfill and future writes. Casting is inside
-- CASE: SQL predicate reordering must not turn malformed history into an error.
CREATE OR REPLACE FUNCTION operator_track_receipt_rows(payload JSONB)
RETURNS TABLE(app_user_id UUID, metadata_release_id UUID, receipt JSONB)
LANGUAGE SQL IMMUTABLE SET search_path = pg_catalog, public
AS $$
  WITH envelope AS (
    SELECT payload->'operatorTrackFulfillment' AS value
  ), expanded AS (
    SELECT value, jsonb_array_elements(CASE
      WHEN value->'version' = '1'::jsonb THEN jsonb_build_array(value)
      WHEN value->'version' = '2'::jsonb THEN CASE
        WHEN jsonb_typeof(value->'receipts') = 'array' THEN CASE
          WHEN jsonb_array_length(value->'receipts') = 2 THEN value->'receipts'
          ELSE '[]'::jsonb END
        ELSE '[]'::jsonb END
      ELSE '[]'::jsonb END) AS receipt
    FROM envelope
  ), bound AS (
    SELECT value, receipt,
      CASE WHEN receipt->>'ownerId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (receipt->>'ownerId')::uuid END AS owner,
      CASE WHEN receipt #>> '{scope,metadataReleaseId}' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (receipt #>> '{scope,metadataReleaseId}')::uuid END AS release
    FROM expanded
  ), eligible AS (
    SELECT * FROM bound WHERE owner IS NOT NULL AND release IS NOT NULL
      AND receipt->'version' = '1'::jsonb
  )
  SELECT owner, release, receipt FROM eligible
  WHERE (SELECT count(*) FROM eligible) = CASE WHEN value->'version' = '2'::jsonb THEN 2 ELSE 1 END
    AND (SELECT count(DISTINCT owner) FROM eligible) = (SELECT count(*) FROM eligible)
    AND (SELECT count(DISTINCT release) FROM eligible) = 1;
$$;

CREATE OR REPLACE FUNCTION sync_operator_track_receipts()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'applied' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS NOT DISTINCT FROM OLD.status
      AND NEW.normalized_payload->'operatorTrackFulfillment'
        IS NOT DISTINCT FROM OLD.normalized_payload->'operatorTrackFulfillment' THEN
      RETURN NEW;
    END IF;
  END IF;
  DELETE FROM public.operator_track_receipts WHERE import_candidate_id = NEW.id;
  IF NEW.status = 'applied' THEN
    INSERT INTO public.operator_track_receipts(import_candidate_id, app_user_id, metadata_release_id, receipt)
      SELECT NEW.id, app_user_id, metadata_release_id, receipt
      FROM public.operator_track_receipt_rows(NEW.normalized_payload);
  END IF;
  RETURN NEW;
END;
$$;

-- Protect backfill against cooperating candidate writers until COMMIT; do not
-- claim online/concurrent index creation inside this startup transaction.
LOCK TABLE import_candidates IN SHARE ROW EXCLUSIVE MODE;
CREATE OR REPLACE TRIGGER import_candidates_track_receipts
  AFTER INSERT OR UPDATE OF status, normalized_payload ON import_candidates
  FOR EACH ROW EXECUTE FUNCTION sync_operator_track_receipts();
INSERT INTO operator_track_receipts(import_candidate_id, app_user_id, metadata_release_id, receipt)
  SELECT candidate.id, receipt.app_user_id, receipt.metadata_release_id, receipt.receipt
  FROM import_candidates candidate
  CROSS JOIN LATERAL operator_track_receipt_rows(candidate.normalized_payload) receipt
  WHERE candidate.status = 'applied'
  ON CONFLICT (import_candidate_id, app_user_id) DO UPDATE
    SET metadata_release_id = EXCLUDED.metadata_release_id, receipt = EXCLUDED.receipt;

COMMIT;
