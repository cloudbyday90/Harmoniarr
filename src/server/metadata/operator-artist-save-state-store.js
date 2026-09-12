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

/** Transaction-only persistence for serializing and checking an operator artist save. */
export function createOperatorArtistSaveStateStore() {
  async function lockOperatorArtistSave({ appUserId, metadataArtistId, client }) {
    // PostgreSQL UUID casts canonicalize equivalent spellings before hashing.
    // Lock even when no monitoring or snapshot row exists yet. A hash collision
    // can only serialize unrelated saves; the revision query retains exact IDs.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext(json_build_array($2::uuid, $3::uuid)::text))', [
      'operator_artist_save', appUserId, metadataArtistId,
    ]);
  }

  async function getSnapshotRevision({ appUserId, metadataArtistId, client }) {
    const result = await client.query(`
      SELECT snapshot_revision
      FROM operator_artist_reconciliation_snapshot
      WHERE app_user_id = $1 AND metadata_artist_id = $2
      ORDER BY snapshot_revision DESC
      LIMIT 1
      FOR UPDATE
    `, [appUserId, metadataArtistId]);
    if (result.rows.length === 0) return 0;
    const raw = result.rows[0].snapshot_revision;
    const revision = typeof raw === 'string' && /^(0|[1-9]\d*)$/u.test(raw) ? Number(raw) : raw;
    if (!Number.isSafeInteger(revision) || revision < 0) {
      throw new Error('Stored artist snapshot revision is invalid');
    }
    return revision;
  }

  return { lockOperatorArtistSave, getSnapshotRevision };
}
