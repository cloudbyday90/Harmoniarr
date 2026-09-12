/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

// Call only after acquiring the app-user eligibility write guards. Keeping this
// read separate gives READ COMMITTED a fresh snapshot after a competing writer.
export async function listPlexDirectoryUserIdentities({ userIds, queryable }) {
  if (userIds.length === 0) return [];
  const result = await queryable.query(`
    SELECT app_users.id, app_users.auth_provider, app_users.auth_subject,
           app_user_plex_profiles.plex_user_id, app_user_plex_profiles.plex_uuid
    FROM app_users
    LEFT JOIN app_user_plex_profiles ON app_user_plex_profiles.app_user_id = app_users.id
    WHERE app_users.id = ANY($1::uuid[])
    ORDER BY app_users.id
  `, [userIds]);
  return result.rows;
}
