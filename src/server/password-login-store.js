/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { lockAppUserEligibility } from './app-user-eligibility-lock-store.js';

const credentialColumns = `id, username, role, must_change_password, last_login_at,
  is_disabled, password_hash, password_changed_at::text AS credential_epoch,
  failed_login_count, locked_until > clock_timestamp() AS login_locked`;

export async function findPasswordLoginUser(client, identifier) {
  const predicate = identifier.includes('@') ? 'lower(email)=$1' : 'username=$1';
  const result = await client.query(`SELECT ${credentialColumns} FROM public.app_users WHERE ${predicate} LIMIT 1`, [identifier]);
  return result.rows[0] ?? null;
}

export async function lockPasswordLoginUser(client, userId) {
  // Take write mode initially: simultaneous logins must not upgrade shared locks.
  await lockAppUserEligibility({ userIds: [userId], mode: 'write', queryable: client });
  const result = await client.query(`SELECT ${credentialColumns} FROM public.app_users WHERE id=$1`, [userId]);
  return result.rows[0] ?? null;
}

export async function upgradePasswordLoginHash(client, accepted, replacement) {
  // Rehashing the same secret must preserve its epoch and existing sessions.
  const result = await client.query(`UPDATE public.app_users SET password_hash=$2, updated_at=clock_timestamp()
    WHERE id=$1 AND password_hash=$3
      AND password_changed_at IS NOT DISTINCT FROM $4::timestamptz AND is_disabled=FALSE`,
  [accepted.id, replacement, accepted.password_hash, accepted.credential_epoch]);
  if (result.rowCount !== 1) throw new Error('Login credential changed before hash upgrade');
}
