/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { lockAppUserEligibility } from './app-user-eligibility-lock-store.js';

export async function findLinkedPlexLoginUser(client, subjects) {
  const result = await client.query(`SELECT id, auth_provider, auth_subject FROM public.app_users
    WHERE auth_provider='plex' AND auth_subject=ANY($1::text[])
    ORDER BY array_position($1::text[], auth_subject), updated_at DESC LIMIT 1`, [subjects]);
  return result.rows[0] ?? null;
}

export async function lockLinkedLoginUser(client, userId) {
  await lockAppUserEligibility({ userIds: [userId], mode: 'write', queryable: client });
  const result = await client.query('SELECT id, auth_provider, auth_subject, is_disabled FROM public.app_users WHERE id=$1', [userId]);
  return result.rows[0] ?? null;
}
