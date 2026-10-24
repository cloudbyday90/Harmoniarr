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

-- forward-only migration
BEGIN;

-- Block candidate writers throughout backfill and trigger installation.
LOCK TABLE public.import_candidates IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE public.import_candidate_search_revisions (
  source_search_id text PRIMARY KEY,
  revision uuid NOT NULL DEFAULT public.harmoniarr_generate_uuid()
);

INSERT INTO public.import_candidate_search_revisions (source_search_id)
SELECT DISTINCT source_search_id FROM public.import_candidates;

CREATE FUNCTION public.harmoniarr_rotate_candidate_search_revisions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  search_ids text[];
  search_id text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT array_agg(source_search_id ORDER BY source_search_id) INTO search_ids
      FROM (SELECT DISTINCT source_search_id FROM new_candidates) affected;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT array_agg(source_search_id ORDER BY source_search_id) INTO search_ids
      FROM (SELECT DISTINCT source_search_id FROM old_candidates) affected;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT array_agg(source_search_id ORDER BY source_search_id) INTO search_ids
      FROM (SELECT source_search_id FROM old_candidates UNION SELECT source_search_id FROM new_candidates) affected;
  ELSE
    SELECT array_agg(source_search_id ORDER BY source_search_id) INTO search_ids
      FROM public.import_candidate_search_revisions;
  END IF;
  FOREACH search_id IN ARRAY COALESCE(search_ids, ARRAY[]::text[]) LOOP
    INSERT INTO public.import_candidate_search_revisions (source_search_id, revision)
      VALUES (search_id, public.harmoniarr_generate_uuid())
      ON CONFLICT (source_search_id) DO UPDATE SET revision = EXCLUDED.revision;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER import_candidates_search_revision_insert
  AFTER INSERT ON public.import_candidates REFERENCING NEW TABLE AS new_candidates
  FOR EACH STATEMENT EXECUTE FUNCTION public.harmoniarr_rotate_candidate_search_revisions();
CREATE TRIGGER import_candidates_search_revision_update
  AFTER UPDATE ON public.import_candidates REFERENCING OLD TABLE AS old_candidates NEW TABLE AS new_candidates
  FOR EACH STATEMENT EXECUTE FUNCTION public.harmoniarr_rotate_candidate_search_revisions();
CREATE TRIGGER import_candidates_search_revision_delete
  AFTER DELETE ON public.import_candidates REFERENCING OLD TABLE AS old_candidates
  FOR EACH STATEMENT EXECUTE FUNCTION public.harmoniarr_rotate_candidate_search_revisions();
CREATE TRIGGER import_candidates_search_revision_truncate
  AFTER TRUNCATE ON public.import_candidates
  FOR EACH STATEMENT EXECUTE FUNCTION public.harmoniarr_rotate_candidate_search_revisions();

COMMIT;
