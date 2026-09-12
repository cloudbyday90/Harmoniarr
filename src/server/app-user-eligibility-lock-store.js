/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export async function lockAppUserEligibility({ userIds, mode = 'read', queryable }) {
  if (!queryable || typeof queryable.query !== 'function' || !['read', 'write'].includes(mode)
    || !Array.isArray(userIds) || userIds.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new Error('Eligibility guards require user identifiers and a transaction client');
  }
  if (!userIds.length) return;
  // app_users is the stable guard even when its optional Plex profile is absent.
  // Use a separate statement before reading the joined eligibility snapshot:
  // READ COMMITTED must take that snapshot only after any lock wait finishes.
  const lockMode = mode === 'write' ? 'FOR NO KEY UPDATE' : 'FOR SHARE';
  await queryable.query(`SELECT id FROM app_users WHERE id = ANY($1::uuid[]) ORDER BY id ${lockMode}`,
    [[...new Set(userIds)]]);
}
