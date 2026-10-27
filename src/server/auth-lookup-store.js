/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export async function hasBootstrapUsers(client) {
  const result = await client.query('SELECT EXISTS (SELECT 1 FROM public.app_users) AS has_users');
  if (typeof result.rows[0]?.has_users !== 'boolean') throw new Error('Invalid bootstrap existence result');
  return result.rows[0].has_users;
}
