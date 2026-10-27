/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPool } from './database.js';
import { lockAppUserEligibility } from './app-user-eligibility-lock-store.js';

const credentialColumns = `id, username, role, must_change_password, last_login_at,
  is_disabled, password_hash, password_changed_at::text AS credential_epoch,
  failed_login_count, locked_until > clock_timestamp() AS login_locked`;

export async function findPasswordLoginUser(identifier) {
  const predicate = identifier.includes('@') ? 'lower(email)=$1' : 'username=$1';
  const result = await getPool().query(`SELECT ${credentialColumns} FROM public.app_users WHERE ${predicate} LIMIT 1`, [identifier]);
  return result.rows[0] ?? null;
}

export async function lockPasswordLoginUser(client, userId) {
  // Take write mode initially: simultaneous logins must not upgrade shared locks.
  await lockAppUserEligibility({ userIds: [userId], mode: 'write', queryable: client });
  const result = await client.query(`SELECT ${credentialColumns} FROM public.app_users WHERE id=$1`, [userId]);
  return result.rows[0] ?? null;
}

export async function recordSuccessfulPasswordLogin(client, userId) {
  const result = await client.query(`UPDATE public.app_users SET failed_login_count=0,
    locked_until=NULL, last_login_at=clock_timestamp(), updated_at=clock_timestamp()
    WHERE id=$1 RETURNING id, username, role, must_change_password, last_login_at`, [userId]);
  if (result.rowCount !== 1) throw new Error('Login account changed before publication');
  return result.rows[0];
}
