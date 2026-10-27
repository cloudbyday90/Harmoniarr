/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { lockAppUserEligibility } from './app-user-eligibility-lock-store.js';

export async function findPasswordChangeUser(client, userId) {
  const result = await client.query(`SELECT id, username, role, must_change_password, last_login_at,
    is_disabled, password_hash, password_changed_at::text AS credential_epoch FROM public.app_users WHERE id=$1`, [userId]);
  return result.rows[0] ?? null;
}

export async function lockPasswordChangeUser(client, userId) {
  // Take write mode first: excludes every participating issuer/replay owner.
  await lockAppUserEligibility({ userIds: [userId], mode: 'write', queryable: client });
  return findPasswordChangeUser(client, userId);
}

export async function replacePasswordChangeCredential(client, accepted, passwordHash) {
  const result = await client.query(`UPDATE public.app_users SET password_hash=$2,
    must_change_password=FALSE, password_changed_at=clock_timestamp(), updated_at=clock_timestamp()
    WHERE id=$1 AND password_hash=$3 AND password_changed_at IS NOT DISTINCT FROM $4::timestamptz
      AND is_disabled=FALSE RETURNING id, username, role, must_change_password, last_login_at`,
  [accepted.id, passwordHash, accepted.password_hash, accepted.credential_epoch]);
  if (result.rowCount !== 1) throw new Error('Password change credential admission changed');
  return result.rows[0];
}

export async function revokePasswordChangeSessions(client, userId) {
  const result = await client.query(`UPDATE public.refresh_tokens SET is_revoked=TRUE,
    revoked_at=clock_timestamp(), revoked_reason='password_changed'
    WHERE app_user_id=$1 AND is_revoked=FALSE`, [userId]);
  if (!Number.isSafeInteger(result.rowCount) || result.rowCount < 1) throw new Error('Password change session revocation refused');
  const remaining = await client.query('SELECT EXISTS(SELECT 1 FROM public.refresh_tokens WHERE app_user_id=$1 AND is_revoked=FALSE) AS active', [userId]);
  if (remaining.rows[0]?.active !== false) throw new Error('Password change left active prior sessions');
  return result.rowCount;
}
