/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export async function findRefreshTokenSession(client, tokenHash) {
  const result = await client.query(`SELECT
    refresh_tokens.id AS refresh_token_id, refresh_tokens.app_user_id,
    refresh_tokens.token_family_id, refresh_tokens.csrf_token_hash,
    refresh_tokens.expires_at, refresh_tokens.is_revoked, refresh_tokens.revoked_reason,
    refresh_tokens.replaced_by_refresh_token_id,
    app_users.id, app_users.username, app_users.role, app_users.must_change_password,
    app_users.last_login_at, app_users.is_disabled
    FROM public.refresh_tokens
    JOIN public.app_users ON app_users.id = refresh_tokens.app_user_id
    WHERE refresh_tokens.token_hash = $1 LIMIT 1`, [tokenHash]);
  return result.rows[0] ?? null;
}
