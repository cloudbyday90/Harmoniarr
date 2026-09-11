/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../database.js';

/** Select authorized identities before any candidate, transfer, or apply enrichment. */
export function createLibraryWantedReleasePageStore({ getPoolFn = getPool } = {}) {
  async function listWantedReleaseIdentityPage({ appUserIds, search = null, after = null, limit = 50 }) {
    const targetUserIds = Array.isArray(appUserIds) ? [...new Set(appUserIds.filter((id) => typeof id === 'string' && id))] : [];
    if (!targetUserIds.length) return { rows: [], hasMore: false };
    const pageLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 50, 100));
    const singleTarget = targetUserIds.length === 1;
    const parameters = [singleTarget ? targetUserIds[0] : targetUserIds];
    const predicates = [singleTarget ? 'lwr.app_user_id = $1::uuid' : 'lwr.app_user_id = ANY($1::uuid[])'];
    const metadataJoins = search ? `
      JOIN metadata_artists ma ON ma.id = lwr.metadata_artist_id
      JOIN metadata_release_groups mrg ON mrg.id = lwr.metadata_release_group_id
      JOIN metadata_releases mr ON mr.id = lwr.metadata_release_id` : '';
    if (search) {
      parameters.push(`%${search.trim().toLowerCase().slice(0, 120)}%`);
      predicates.push(`(LOWER(ma.name) LIKE $${parameters.length} OR LOWER(mrg.title) LIKE $${parameters.length} OR LOWER(mr.title) LIKE $${parameters.length})`);
    }
    if (after) {
      parameters.push(after.createdAtKey, after.id);
      predicates.push(`(lwr.created_at, lwr.id) < ($${parameters.length - 1}::timestamptz, $${parameters.length}::uuid)`);
    }
    parameters.push(pageLimit + 1);
    const result = await getPoolFn().query(`
      SELECT lwr.id, to_char(lwr.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at_key
      FROM library_wanted_releases lwr
      ${metadataJoins}
      WHERE ${predicates.join(' AND ')}
      ORDER BY lwr.created_at DESC, lwr.id DESC
      LIMIT $${parameters.length}
    `, parameters);
    return {
      rows: result.rows.slice(0, pageLimit).map((row) => ({ id: row.id, createdAtKey: row.created_at_key })),
      hasMore: result.rows.length > pageLimit,
    };
  }
  return { listWantedReleaseIdentityPage };
}
