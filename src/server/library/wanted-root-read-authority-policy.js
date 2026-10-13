/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
const body = `BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('harmoniarr.library-request-projection', 0));
  RETURN NULL;
END;`;
const columns = { app_users: ['id', 'is_disabled', 'managed_library_relative_root'], app_settings: [] };

export function validWantedRootReadProof(rows) {
  if (!Array.isArray(rows) || rows.length !== 2 || rows.some(row => !row || typeof row !== 'object')
    || new Set(rows.map(row => row.table_name)).size !== 2) return false;
  return rows.every(row => Object.hasOwn(columns, row.table_name)
    && row.trigger_name === `${row.table_name}_root_authority_admission` && row.enabled === 'O' && row.trigger_type === 30
    && row.unconditional === true
    && JSON.stringify(row.columns) === JSON.stringify(columns[row.table_name])
    && row.function_schema === 'public' && row.function_name === 'harmoniarr_root_authority_admission'
    && row.language === 'plpgsql' && row.security_definer === false && row.volatility === 'v'
    && JSON.stringify(row.function_config) === JSON.stringify(['search_path=pg_catalog'])
    && typeof row.function_body === 'string' && row.function_body.trim() === body && row.held_authority === true && row.origin_mode === true
    && row.read_committed === true && typeof row.transaction_id === 'string' && /^\d+$/u.test(row.transaction_id)
    && row.transaction_id === rows[0].transaction_id);
}
