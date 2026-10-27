/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
/** Recheck the observed token and revoke only still-active rows of its owner/family. */
export async function revokeReplayedSessionFamily(client, { refreshTokenId, appUserId, tokenFamilyId }) {
  const result = await client.query(`
    UPDATE public.refresh_tokens AS active
    SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = 'reuse_detected'
    FROM public.refresh_tokens AS replay
    JOIN public.app_users AS owner ON owner.id = replay.app_user_id
    WHERE replay.id = $1 AND replay.app_user_id = $2 AND replay.token_family_id = $3
      AND replay.is_revoked = TRUE AND replay.replaced_by_refresh_token_id IS NOT NULL
      AND replay.expires_at > clock_timestamp() AND owner.is_disabled = FALSE
      AND active.app_user_id = replay.app_user_id AND active.token_family_id = replay.token_family_id
      AND active.is_revoked = FALSE
    RETURNING replay.revoked_reason
  `, [refreshTokenId, appUserId, tokenFamilyId]);
  return { revokedSessions: result.rowCount ?? 0, previousRevokedReason: result.rows[0]?.revoked_reason ?? null };
}
