/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

export function createAdminRecoveryAccountStore() {
  async function upsertAdminAccount({ username, passwordHash, queryable }) {
    const result = await queryable.query(`
      INSERT INTO app_users (username, password_hash, role, password_changed_at)
      VALUES ($1, $2, 'admin', NOW())
      ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          role = 'admin', is_disabled = FALSE, must_change_password = FALSE,
          password_changed_at = NOW(), failed_login_count = 0, locked_until = NULL,
          updated_at = NOW()
      RETURNING id
    `, [username, passwordHash]);
    return result.rows[0].id;
  }
  return { upsertAdminAccount };
}
