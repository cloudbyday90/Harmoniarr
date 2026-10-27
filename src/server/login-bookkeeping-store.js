/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export async function recordSuccessfulLogin(client, userId) {
  const result = await client.query(`UPDATE public.app_users SET failed_login_count=0,
    locked_until=NULL, last_login_at=clock_timestamp(), updated_at=clock_timestamp()
    WHERE id=$1 RETURNING id, username, role, must_change_password, last_login_at`, [userId]);
  if (result.rowCount !== 1) throw new Error('Login account changed before publication');
  return result.rows[0];
}
