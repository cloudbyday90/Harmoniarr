-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
-- This program is free software: licensed under GPL-3.0-or-later.
-- See LICENSE for details.
-- forward-only migration
BEGIN;

-- Publishers already acquire this transaction lock before reading their roots.
-- Statement admission precedes tuple locks, including absent settings/upserts.
CREATE FUNCTION public.harmoniarr_root_authority_admission() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('harmoniarr.library-request-projection', 0));
  RETURN NULL;
END;
$$;

CREATE TRIGGER app_users_root_authority_admission
BEFORE INSERT OR DELETE OR UPDATE OF id, is_disabled, managed_library_relative_root
ON public.app_users FOR EACH STATEMENT
EXECUTE FUNCTION public.harmoniarr_root_authority_admission();

-- A statement cannot inspect its selected rows before tuple locking. Admit all
-- settings DML rather than introduce a row-lock/projection-lock inversion.
CREATE TRIGGER app_settings_root_authority_admission
BEFORE INSERT OR UPDATE OR DELETE ON public.app_settings FOR EACH STATEMENT
EXECUTE FUNCTION public.harmoniarr_root_authority_admission();

COMMIT;
