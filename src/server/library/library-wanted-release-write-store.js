/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { getPool } from '../database.js';
import { createApiError } from '../auth.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { normalizeMetadataReleaseDateForDateColumn } from '../metadata/metadata-release-date-normalization.js';
import { createLibraryDiscoveryRequestWantedReleaseLinkStore } from './library-discovery-request-wanted-release-link-store.js';
import { lockLibraryRequestProjection } from './library-request-projection-lock-store.js';
import { wantedPairKey, canonicalizeWantedPair } from './library-wanted-release-reconciliation-policy.js';

export function createLibraryWantedReleaseWriteStore({
  getPoolFn = getPool,
  withTransaction = createDatabaseTransactionRunner({ getPoolFn }),
  libraryDiscoveryRequestWantedReleaseLinkStore = createLibraryDiscoveryRequestWantedReleaseLinkStore(),
} = {}) {
  if (typeof libraryDiscoveryRequestWantedReleaseLinkStore.syncActiveWantedReleaseLinks !== 'function') {
    throw new TypeError('Wanted replacement requires discovery link synchronization');
  }
  async function replaceLibraryWantedReleases({ wantedReleases, queryable = null, beforeWrite = null }) {
    if (!Array.isArray(wantedReleases)) throw new TypeError('Wanted releases must be an array');
    if (queryable != null && typeof queryable.query !== 'function') throw new TypeError('Wanted replacement queryable must supply query');
    if (beforeWrite != null && typeof beforeWrite !== 'function') throw new TypeError('Wanted replacement guard must be a function');
    const rowsByKey = new Map();
    for (const row of wantedReleases) {
      if (typeof row?.appUserId !== 'string' || !row.appUserId.trim()
        || typeof row.metadataReleaseId !== 'string' || !row.metadataReleaseId.trim()) {
        throw new TypeError('Wanted replacement requires both ownership identifiers');
      }
      const normalized = { ...row, ...canonicalizeWantedPair(row) };
      const key = wantedPairKey(normalized); rowsByKey.delete(key); rowsByKey.set(key, normalized);
    }
    const rows = [...rowsByKey.values()];
    const keys = rows.map((row) => ({ appUserId: row.appUserId, metadataReleaseId: row.metadataReleaseId }));
    const values = ['appUserId', 'metadataArtistId', 'metadataReleaseGroupId', 'metadataReleaseId', 'wantedStatus',
      'expectedTrackCount', 'matchedTrackCount', 'missingTrackCount'].map((field) => rows.map((row) => row[field]));
    values.push(rows.map((row) => normalizeMetadataReleaseDateForDateColumn(row.releaseDate)),
      rows.map((row) => row.releaseStatus ?? null), rows.map((row) => JSON.stringify(row.evidence ?? {})));
    const toKey = (row) => ({ appUserId: row.app_user_id, metadataReleaseId: row.metadata_release_id });
    const incomplete = () => createApiError(409, 'library_wanted_projection_incomplete', 'The complete wanted projection was not replaced');
    async function replace(client) {
      await lockLibraryRequestProjection({ queryable: client });
      const targets = (await client.query('SELECT app_user_id, metadata_release_id FROM library_wanted_releases ORDER BY app_user_id, metadata_release_id')).rows;
      const retained = new Set(keys.map(wantedPairKey));
      const expectedDeleted = new Set(targets.map(toKey).map(wantedPairKey).filter((key) => !retained.has(key)));
      await beforeWrite?.({ queryable: client, stage: 'delete' });
      const deleted = await client.query(`DELETE FROM library_wanted_releases
        WHERE NOT EXISTS (SELECT 1 FROM UNNEST($1::uuid[], $2::uuid[]) AS kept(app_user_id, metadata_release_id)
          WHERE kept.app_user_id=library_wanted_releases.app_user_id AND kept.metadata_release_id=library_wanted_releases.metadata_release_id)
        RETURNING app_user_id, metadata_release_id`, [values[0], values[3]]);
      if (deleted.rowCount !== expectedDeleted.size || deleted.rows.length !== expectedDeleted.size
        || !deleted.rows.every((row) => expectedDeleted.delete(wantedPairKey(toKey(row))))) throw incomplete();
      if (keys.length > 0) {
        await beforeWrite?.({ queryable: client, stage: 'upsert_batch' });
        const written = await client.query(`
          INSERT INTO library_wanted_releases(app_user_id,metadata_artist_id,metadata_release_group_id,metadata_release_id,
            wanted_status,expected_track_count,matched_track_count,missing_track_count,release_date,release_status,evidence,last_reconciled_at,updated_at)
          SELECT t.*,clock_timestamp(),clock_timestamp()
          FROM UNNEST($1::uuid[],$2::uuid[],$3::uuid[],$4::uuid[],$5::text[],$6::integer[],$7::integer[],
            $8::integer[],$9::date[],$10::text[],$11::jsonb[]) AS t(app_user_id,metadata_artist_id,metadata_release_group_id,
            metadata_release_id,wanted_status,expected_track_count,matched_track_count,missing_track_count,release_date,release_status,evidence)
          WHERE TRUE
          ON CONFLICT(app_user_id,metadata_release_id) DO UPDATE SET metadata_artist_id=EXCLUDED.metadata_artist_id,
            metadata_release_group_id=EXCLUDED.metadata_release_group_id,wanted_status=EXCLUDED.wanted_status,
            expected_track_count=EXCLUDED.expected_track_count,matched_track_count=EXCLUDED.matched_track_count,
            missing_track_count=EXCLUDED.missing_track_count,release_date=EXCLUDED.release_date,release_status=EXCLUDED.release_status,
            evidence=EXCLUDED.evidence,last_reconciled_at=clock_timestamp(),updated_at=clock_timestamp()
          RETURNING app_user_id,metadata_release_id
        `, values);
        const expectedWritten = new Set(retained);
        if (written.rowCount !== keys.length || written.rows.length !== keys.length
          || !written.rows.every((row) => expectedWritten.delete(wantedPairKey(toKey(row))))) throw incomplete();
      }
      await beforeWrite?.({ queryable: client, stage: 'links' });
      await libraryDiscoveryRequestWantedReleaseLinkStore.syncActiveWantedReleaseLinks({ client });
      return { wantedKeys: keys, deletedWantedKeys: deleted.rows.map(toKey) };
    }
    return queryable ? replace(queryable) : withTransaction(replace);
  }

  return { replaceLibraryWantedReleases };
}
