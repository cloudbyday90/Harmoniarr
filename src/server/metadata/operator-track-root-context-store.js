/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { getPool } from '../database.js';
import { createApiError } from '../auth.js';

export function createOperatorTrackRootContextStore({ getPoolFn = getPool } = {}) {
  async function readOwnerRootContext({ ownerId, queryable = null, expectedTransactionId = null }) {
    const row = (await (queryable ?? getPoolFn()).query(`SELECT owner.id,owner.is_disabled,owner.managed_library_relative_root,
      root_transaction.transaction_id,
      root_setting.setting_key IS NOT NULL AS has_music_root_setting,root_setting.setting_value AS music_root
      FROM (SELECT pg_catalog.pg_current_xact_id_if_assigned()::text AS transaction_id) root_transaction
      LEFT JOIN app_users owner ON owner.id=$1::uuid LEFT JOIN app_settings root_setting
        ON root_setting.namespace='paths' AND root_setting.setting_key='music'
      `, [ownerId])).rows[0];
    if (expectedTransactionId !== null && row?.transaction_id !== expectedTransactionId) {
      throw createApiError(409, 'library_wanted_projection_stale', 'The root verification transaction changed');
    }
    return row?.id ? { owner: { id: row.id, is_disabled: row.is_disabled, managed_library_relative_root: row.managed_library_relative_root },
      hasMusicRootSetting: row.has_music_root_setting, musicRoot: row.music_root } : null;
  }
  return { readOwnerRootContext };
}
