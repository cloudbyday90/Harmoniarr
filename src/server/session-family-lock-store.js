/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createHash } from 'node:crypto';
import { lockAppUserEligibility } from './app-user-eligibility-lock-store.js';

export async function lockSessionOwner(client, appUserId) {
  await lockAppUserEligibility({ userIds: [appUserId], queryable: client });
  // Separate snapshot after the row lock wait; hold account eligibility to commit.
  const result = await client.query(`SELECT id, username, role, must_change_password,
    last_login_at, is_disabled, password_changed_at::text AS password_changed_at FROM public.app_users WHERE id=$1`, [appUserId]);
  return result.rows[0] ?? null;
}

export function sessionFamilyLockKey(tokenFamilyId) {
  if (typeof tokenFamilyId !== 'string' || !tokenFamilyId) throw new TypeError('A session family identity is required');
  return createHash('sha256').update('harmoniarr:session-family:v1\0' + tokenFamilyId.toLowerCase()).digest().readBigInt64BE().toString();
}

/** Account first, family second, parent row last; every descendant issuer participates. */
export async function lockSessionFamily(client, tokenFamilyId) {
  await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [sessionFamilyLockKey(tokenFamilyId)]);
}
