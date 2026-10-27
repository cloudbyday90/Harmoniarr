/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export async function lockRotationParent(client, identity) {
  const result = await client.query(`SELECT id AS refresh_token_id, app_user_id, token_family_id,
    is_revoked, revoked_reason, replaced_by_refresh_token_id,
    expires_at > clock_timestamp() AS unexpired,
    issued_at >= COALESCE($5::timestamptz, '-infinity'::timestamptz) AS current_password
    FROM public.refresh_tokens WHERE id=$1 AND app_user_id=$2 AND token_family_id=$3 AND token_hash=$4 FOR UPDATE`,
  [identity.refreshTokenId, identity.appUserId, identity.tokenFamilyId, identity.tokenHash, identity.passwordChangedAt]);
  return result.rows[0] ?? null;
}

export async function insertSessionToken(client, { userId, parentRefreshTokenId = null, material, metadata }) {
  const result = await client.query(`INSERT INTO public.refresh_tokens (app_user_id, token_hash, token_family_id,
    parent_refresh_token_id, csrf_token_hash, issued_at, expires_at, issued_ip, issued_user_agent)
    VALUES ($1,$2,$3,$4,$5,clock_timestamp(),$6,$7,$8) RETURNING id`,
  [userId, material.tokenHash, material.tokenFamilyId, parentRefreshTokenId, material.csrfTokenHash,
    material.expiresAt, metadata.ipAddress, metadata.userAgent]);
  return result.rows[0].id;
}

export async function replaceSessionParent(client, { identity, childId }) {
  const result = await client.query(`UPDATE public.refresh_tokens SET is_revoked=TRUE,
    revoked_at=clock_timestamp(), revoked_reason='rotated', replaced_by_refresh_token_id=$2, last_used_at=clock_timestamp()
    WHERE id=$1 AND app_user_id=$3 AND token_family_id=$4 AND token_hash=$5
      AND is_revoked=FALSE AND replaced_by_refresh_token_id IS NULL AND expires_at>clock_timestamp()`,
  [identity.refreshTokenId, childId, identity.appUserId, identity.tokenFamilyId, identity.tokenHash]);
  if (result.rowCount !== 1) throw new Error('Session rotation admission changed');
}

export async function assertRotationNotExpired(client, refreshTokenId) {
  const result = await client.query('SELECT expires_at>clock_timestamp() AS unexpired FROM public.refresh_tokens WHERE id=$1', [refreshTokenId]);
  if (result.rows[0]?.unexpired !== true) throw new Error('Session expired before rotation publication');
}
