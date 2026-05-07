/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { getPool } from '../database.js';

/** Country preference order for tie-breaking canonical release selection. */
const COUNTRY_PREFERENCE = ['XW', 'GB', 'US'];

/**
 * Computes the median of a sorted numeric array.
 * Returns 0 for an empty array.
 */
function median(sortedNumbers) {
  const len = sortedNumbers.length;
  if (len === 0) return 0;
  const mid = Math.floor(len / 2);
  return len % 2 === 0
    ? (sortedNumbers[mid - 1] + sortedNumbers[mid]) / 2
    : sortedNumbers[mid];
}

/**
 * Selects the best canonical release from a list of DB rows.
 *
 * Algorithm:
 * 1. Filter to status = 'Official' if any official releases exist.
 * 2. Exclude releases with track_count > 1.5 × median_track_count (deluxe editions).
 * 3. Prefer earliest release_date (nulls last).
 * 4. Tie-break by country: XW > GB > US > others.
 * 5. Final tie-break: lowest created_at.
 *
 * @param {object[]} rows - Rows from metadata_releases.
 * @returns {object|null} The best release row, or null if rows is empty.
 */
export function selectCanonicalRelease(rows) {
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];

  // Step 1: prefer official releases.
  const official = rows.filter((r) => r.status === 'Official');
  const candidates = official.length > 0 ? official : rows;

  // Step 2: exclude deluxe/bloated editions (track_count > 1.5 × median).
  const trackCounts = candidates
    .map((r) => r.track_count ?? 0)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const med = median(trackCounts);
  const threshold = med * 1.5;
  const filtered = med > 0 ? candidates.filter((r) => (r.track_count ?? 0) <= threshold) : candidates;
  const pool = filtered.length > 0 ? filtered : candidates;

  // Steps 3–5: sort by date, country preference, then created_at.
  const sorted = [...pool].sort((a, b) => {
    // Step 3: earliest release_date (nulls last).
    const dateA = a.release_date;
    const dateB = b.release_date;
    if (dateA !== dateB) {
      if (!dateA) return 1;
      if (!dateB) return -1;
      if (dateA < dateB) return -1;
      if (dateA > dateB) return 1;
    }

    // Step 4: country preference.
    const rankA = COUNTRY_PREFERENCE.indexOf(a.country ?? '');
    const rankB = COUNTRY_PREFERENCE.indexOf(b.country ?? '');
    const adjRankA = rankA === -1 ? COUNTRY_PREFERENCE.length : rankA;
    const adjRankB = rankB === -1 ? COUNTRY_PREFERENCE.length : rankB;
    if (adjRankA !== adjRankB) return adjRankA - adjRankB;

    // Step 5: lowest created_at.
    const createdA = a.created_at ? new Date(a.created_at).getTime() : Infinity;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : Infinity;
    return createdA - createdB;
  });

  return sorted[0];
}

/**
 * Forces a specific release to be canonical, bypassing the automatic algorithm.
 * Used for user-override via PATCH /api/v1/metadata/releases/:id/canonical.
 *
 * @param {string} releaseId - Local UUID of the metadata_release to mark canonical.
 * @param {{ getPoolFn?: function }} [options]
 * @returns {Promise<{ releaseGroupId: string }|null>} The release group ID, or null if not found.
 */
export async function forceCanonicalRelease(releaseId, { getPoolFn = getPool } = {}) {
  const pool = await getPoolFn();

  const { rows } = await pool.query(
    `SELECT metadata_release_group_id FROM metadata_releases WHERE id = $1 LIMIT 1`,
    [releaseId],
  );

  if (rows.length === 0) return null;

  const releaseGroupId = rows[0].metadata_release_group_id;

  await pool.query(
    `UPDATE metadata_releases SET is_canonical = FALSE WHERE metadata_release_group_id = $1 AND is_canonical = TRUE`,
    [releaseGroupId],
  );

  await pool.query(
    `UPDATE metadata_releases SET is_canonical = TRUE WHERE id = $1`,
    [releaseId],
  );

  return { releaseGroupId };
}

/**
 * Selects and persists the canonical release for a release group using the
 * automatic algorithm.
 *
 * Runs two UPDATEs in sequence:
 *   1. Clear is_canonical on all releases in the group.
 *   2. Set is_canonical = TRUE on the selected winner.
 *
 * No-op if the release group has no releases. Idempotent — safe to call
 * multiple times.
 *
 * @param {string} releaseGroupId - Local UUID of the metadata_release_group.
 * @param {{ getPoolFn?: function }} [options]
 */
export async function markCanonicalRelease(releaseGroupId, { getPoolFn = getPool } = {}) {
  const pool = await getPoolFn();

  const { rows } = await pool.query(
    `SELECT * FROM metadata_releases WHERE metadata_release_group_id = $1`,
    [releaseGroupId],
  );

  if (rows.length === 0) return;

  const winner = selectCanonicalRelease(rows);
  if (!winner) return;

  await pool.query(
    `UPDATE metadata_releases SET is_canonical = FALSE WHERE metadata_release_group_id = $1 AND is_canonical = TRUE`,
    [releaseGroupId],
  );

  await pool.query(
    `UPDATE metadata_releases SET is_canonical = TRUE WHERE id = $1`,
    [winner.id],
  );
}
