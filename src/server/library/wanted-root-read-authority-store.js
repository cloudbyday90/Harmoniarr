/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
export async function readWantedRootReadAuthorityProof({ queryable }) {
  return (await queryable.query(`WITH authority AS (SELECT pg_catalog.hashtextextended($1,0) AS key)
    SELECT relation.relname AS table_name, trigger.tgname AS trigger_name, trigger.tgenabled AS enabled,
      trigger.tgtype::integer AS trigger_type,
      trigger.tgqual IS NULL AS unconditional,
      ARRAY(SELECT attribute.attname::text FROM pg_catalog.pg_attribute attribute
        WHERE attribute.attrelid=relation.oid AND attribute.attnum=ANY(trigger.tgattr) ORDER BY attribute.attname) AS columns,
      function_namespace.nspname AS function_schema, function.proname AS function_name,
      language.lanname AS language, function.prosecdef AS security_definer, function.provolatile AS volatility,
      function.proconfig AS function_config, function.prosrc AS function_body,
      pg_catalog.pg_current_xact_id()::text AS transaction_id,
      pg_catalog.current_setting('transaction_isolation')='read committed' AS read_committed,
      pg_catalog.current_setting('session_replication_role')='origin' AS origin_mode,
      EXISTS(SELECT 1 FROM pg_catalog.pg_locks lock CROSS JOIN authority
        WHERE lock.pid=pg_catalog.pg_backend_pid() AND lock.locktype='advisory' AND lock.granted
          AND lock.mode='ExclusiveLock' AND lock.objsubid=1
          AND lock.classid=((authority.key >> 32) & 4294967295)::oid
          AND lock.objid=(authority.key & 4294967295)::oid) AS held_authority
    FROM pg_catalog.pg_trigger trigger
    JOIN pg_catalog.pg_class relation ON relation.oid=trigger.tgrelid
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace
    JOIN pg_catalog.pg_proc function ON function.oid=trigger.tgfoid
    JOIN pg_catalog.pg_namespace function_namespace ON function_namespace.oid=function.pronamespace
    JOIN pg_catalog.pg_language language ON language.oid=function.prolang
    WHERE namespace.nspname='public' AND NOT trigger.tgisinternal
      AND ((relation.relname='app_users' AND trigger.tgname='app_users_root_authority_admission')
        OR (relation.relname='app_settings' AND trigger.tgname='app_settings_root_authority_admission'))`,
  ['harmoniarr.library-request-projection'])).rows;
}
