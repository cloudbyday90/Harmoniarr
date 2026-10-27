/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const failureThreshold = 5;
const lockoutSeconds = 15 * 60;

/** Caller holds account write eligibility and has checked the accepted credentials. */
export async function incrementLoginFailure(client, userId) {
  const result = await client.query(`UPDATE public.app_users SET
    failed_login_count=CASE WHEN failed_login_count >= $2::integer-1 THEN $2
      ELSE GREATEST(failed_login_count,0)+1 END,
    locked_until=CASE WHEN failed_login_count >= $2::integer-1
      THEN clock_timestamp()+make_interval(secs => $3::integer) ELSE locked_until END,
    updated_at=clock_timestamp()
    WHERE id=$1 AND (locked_until IS NULL OR locked_until<=clock_timestamp())
    RETURNING failed_login_count`, [userId, failureThreshold, lockoutSeconds]);
  if (result.rowCount !== 1) throw new Error('Login failure admission changed');
  return result.rows[0].failed_login_count === failureThreshold ? 'locked' : 'counted';
}
