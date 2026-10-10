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
import { createApiError } from '../auth.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { lockLibraryReleaseReconciliation } from './library-release-reconciliation-lock-store.js';

export function createLibraryReleaseReconciliationStore({
  getPoolFn = getPool,
  withTransaction = createDatabaseTransactionRunner({ getPoolFn }),
} = {}) {
  async function listReconciliationsByMetadataReleaseIds({ metadataReleaseIds, queryable = null } = {}) {
    if (!Array.isArray(metadataReleaseIds) || metadataReleaseIds.length < 1) {
      return [];
    }

    const result = await (queryable ?? getPoolFn()).query(
      `
        SELECT
          metadata_artist_id,
          metadata_release_group_id,
          metadata_release_id,
          reconciliation_status,
          expected_track_count,
          matched_track_count,
          missing_track_count,
          matched_file_count,
          duplicate_track_count,
          evidence,
          last_reconciled_at
        FROM library_release_reconciliations
        WHERE metadata_release_id = ANY($1::uuid[])
        ORDER BY metadata_release_id ASC
      `,
      [metadataReleaseIds],
    );

    return result.rows.map((row) => ({
      duplicateTrackCount: Number.parseInt(String(row.duplicate_track_count ?? 0), 10) || 0,
      evidence: row.evidence ?? {},
      expectedTrackCount: Number.parseInt(String(row.expected_track_count ?? 0), 10) || 0,
      lastReconciledAt: row.last_reconciled_at ?? null,
      matchedFileCount: Number.parseInt(String(row.matched_file_count ?? 0), 10) || 0,
      matchedTrackCount: Number.parseInt(String(row.matched_track_count ?? 0), 10) || 0,
      metadataArtistId: row.metadata_artist_id,
      metadataReleaseGroupId: row.metadata_release_group_id,
      metadataReleaseId: row.metadata_release_id,
      missingTrackCount: Number.parseInt(String(row.missing_track_count ?? 0), 10) || 0,
      reconciliationStatus: row.reconciliation_status,
    }));
  }

  async function replaceLibraryReleaseReconciliations({ reconciliations, queryable = null, beforeWrite = null }) {
    if (!Array.isArray(reconciliations)) throw new TypeError('Release reconciliations must be an array');
    if (queryable != null && typeof queryable.query !== 'function') throw new TypeError('Release reconciliation queryable must supply query');
    if (beforeWrite != null && typeof beforeWrite !== 'function') throw new TypeError('Release reconciliation beforeWrite must be a function');
    const rowsById = new Map();
    for (const row of reconciliations) {
      rowsById.delete(row.metadataReleaseId);
      rowsById.set(row.metadataReleaseId, row);
    }
    const rows = [...rowsById.values()];
    const ids = rows.map((row) => row.metadataReleaseId);
    // Copy scalar/JSON persistence values before admission or guard waits.
    const values = ['metadataArtistId', 'metadataReleaseGroupId', 'metadataReleaseId', 'reconciliationStatus',
      'expectedTrackCount', 'matchedTrackCount', 'missingTrackCount', 'matchedFileCount', 'duplicateTrackCount']
      .map((field) => rows.map((row) => row[field]));
    values.push(rows.map((row) => row.evidence == null ? null : JSON.stringify(row.evidence)));
    const incomplete = () => createApiError(409, 'library_release_reconciliation_incomplete', 'The complete release projection was not replaced');
    async function replace(client) {
      await lockLibraryReleaseReconciliation({ queryable: client });
      const targets = await client.query('SELECT metadata_release_id FROM library_release_reconciliations ORDER BY metadata_release_id');
      const retained = new Set(ids);
      const expectedDeleted = new Set(targets.rows.map((row) => row.metadata_release_id).filter((id) => !retained.has(id)));
      await beforeWrite?.({ queryable: client, stage: 'delete' });
      const deleted = await client.query(`DELETE FROM library_release_reconciliations
        WHERE NOT (metadata_release_id = ANY($1::uuid[])) RETURNING metadata_release_id`, [ids]);
      if (deleted.rowCount !== expectedDeleted.size || deleted.rows.length !== expectedDeleted.size
        || !deleted.rows.every((row) => expectedDeleted.delete(row.metadata_release_id))) throw incomplete();
      const deletedMetadataReleaseIds = deleted.rows.map((row) => row.metadata_release_id);
      if (ids.length === 0) return { metadataReleaseIds: [], deletedMetadataReleaseIds };
      await beforeWrite?.({ queryable: client, stage: 'upsert_batch' });
      const written = await client.query(`
        INSERT INTO library_release_reconciliations (metadata_artist_id, metadata_release_group_id,
          metadata_release_id, reconciliation_status, expected_track_count, matched_track_count,
          missing_track_count, matched_file_count, duplicate_track_count, evidence, last_reconciled_at, updated_at)
        SELECT t.*, clock_timestamp(), clock_timestamp()
        FROM UNNEST($1::uuid[], $2::uuid[], $3::uuid[], $4::text[], $5::integer[], $6::integer[],
          $7::integer[], $8::integer[], $9::integer[], $10::jsonb[]) AS t(metadata_artist_id,
          metadata_release_group_id, metadata_release_id, reconciliation_status, expected_track_count,
          matched_track_count, missing_track_count, matched_file_count, duplicate_track_count, evidence)
        WHERE TRUE
        ON CONFLICT (metadata_release_id) DO UPDATE
        SET metadata_artist_id=EXCLUDED.metadata_artist_id, metadata_release_group_id=EXCLUDED.metadata_release_group_id,
          reconciliation_status=EXCLUDED.reconciliation_status, expected_track_count=EXCLUDED.expected_track_count,
          matched_track_count=EXCLUDED.matched_track_count, missing_track_count=EXCLUDED.missing_track_count,
          matched_file_count=EXCLUDED.matched_file_count, duplicate_track_count=EXCLUDED.duplicate_track_count,
          evidence=EXCLUDED.evidence, last_reconciled_at=clock_timestamp(), updated_at=clock_timestamp()
        RETURNING metadata_release_id
      `, values);
      const expectedWritten = new Set(ids);
      if (written.rowCount !== ids.length || written.rows.length !== ids.length
        || !written.rows.every((row) => expectedWritten.delete(row.metadata_release_id))) throw incomplete();
      return { metadataReleaseIds: written.rows.map((row) => row.metadata_release_id), deletedMetadataReleaseIds };
    }
    return queryable ? replace(queryable) : withTransaction(replace);
  }

  async function listLibraryReleasesWithMetadata({
    appUserId = null,
    reconciliationStatus = null,
    limit = 500,
    visibilityState = 'visible',
  } = {}) {
    const params = [];
    const conditions = [];

    const validStatuses = ['complete', 'partial', 'duplicate'];
    if (validStatuses.includes(reconciliationStatus)) {
      params.push(reconciliationStatus);
      conditions.push(`lrr.reconciliation_status = $${params.length}`);
    }

    let visibilityJoin = 'LEFT JOIN operator_library_release_visibility olrv ON FALSE';
    if (appUserId) {
      params.push(appUserId);
      visibilityJoin = `
        LEFT JOIN operator_library_release_visibility olrv
          ON olrv.metadata_release_id = lrr.metadata_release_id
          AND olrv.app_user_id = $${params.length}
      `;

      if (visibilityState === 'removed') {
        conditions.push("olrv.visibility_state = 'removed'");
      } else if (visibilityState !== 'all') {
        conditions.push("COALESCE(olrv.visibility_state, 'visible') = 'visible'");
      }
    }

    params.push(Math.min(Math.max(1, Number.parseInt(String(limit ?? 500), 10) || 500), 2000));
    const limitClause = `LIMIT $${params.length}`;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await getPoolFn().query(
      `
        SELECT
          lrr.id,
          lrr.reconciliation_status,
          lrr.expected_track_count,
          lrr.matched_track_count,
          lrr.missing_track_count,
          lrr.matched_file_count,
          lrr.duplicate_track_count,
          lrr.last_reconciled_at,
          lrr.metadata_artist_id,
          lrr.metadata_release_group_id,
          lrr.metadata_release_id,
          ma.name AS artist_name,
          ma.sort_name AS artist_sort_name,
          mrg.title AS release_group_title,
          mrg.primary_type AS release_group_type,
          mrg.musicbrainz_release_group_id AS musicbrainz_release_group_id,
          mr.title AS release_title,
          mr.disambiguation AS release_disambiguation,
          mr.country AS release_country,
          mr.status AS release_status,
          mr.release_date AS release_date,
          mr.musicbrainz_release_id AS musicbrainz_release_id,
          COALESCE(olrv.visibility_state, 'visible') AS operator_visibility_state,
          olrv.removed_at AS operator_removed_at,
          olrv.restored_at AS operator_restored_at,
          olrv.reason AS operator_visibility_reason
        FROM library_release_reconciliations lrr
        JOIN metadata_artists ma ON ma.id = lrr.metadata_artist_id
        JOIN metadata_release_groups mrg ON mrg.id = lrr.metadata_release_group_id
        JOIN metadata_releases mr ON mr.id = lrr.metadata_release_id
        ${visibilityJoin}
        ${whereClause}
        ORDER BY ma.sort_name ASC NULLS LAST, ma.name ASC, mrg.first_release_date ASC NULLS LAST, mr.release_date ASC NULLS LAST
        ${limitClause}
      `,
      params,
    );

    return result.rows.map((row) => ({
      id: row.id,
      artistName: row.artist_name,
      artistSortName: row.artist_sort_name ?? row.artist_name,
      duplicateTrackCount: Number.parseInt(String(row.duplicate_track_count ?? 0), 10) || 0,
      expectedTrackCount: Number.parseInt(String(row.expected_track_count ?? 0), 10) || 0,
      lastReconciledAt: row.last_reconciled_at ?? null,
      matchedFileCount: Number.parseInt(String(row.matched_file_count ?? 0), 10) || 0,
      matchedTrackCount: Number.parseInt(String(row.matched_track_count ?? 0), 10) || 0,
      metadataArtistId: row.metadata_artist_id,
      metadataReleaseGroupId: row.metadata_release_group_id,
      metadataReleaseId: row.metadata_release_id,
      missingTrackCount: Number.parseInt(String(row.missing_track_count ?? 0), 10) || 0,
      musicbrainzReleaseGroupId: row.musicbrainz_release_group_id ?? null,
      musicbrainzReleaseId: row.musicbrainz_release_id ?? null,
      operatorVisibility: {
        reason: row.operator_visibility_reason ?? null,
        removedAt: row.operator_removed_at ?? null,
        restoredAt: row.operator_restored_at ?? null,
        state: row.operator_visibility_state ?? 'visible',
      },
      reconciliationStatus: row.reconciliation_status,
      releaseCountry: row.release_country ?? null,
      releaseDate: row.release_date ?? null,
      releaseDisambiguation: row.release_disambiguation ?? null,
      releaseGroupTitle: row.release_group_title,
      releaseGroupType: row.release_group_type ?? null,
      releaseStatus: row.release_status ?? null,
      releaseTitle: row.release_title,
    }));
  }

  /**
   * Returns the distinct set of formats (codecs) and genres present in the
   * library. Used by the GET /api/v1/library/filter-options endpoint.
   *
   * `codec_summary` is a future JSONB column (Q7.12) — this query degrades
   * gracefully when the column doesn't exist by returning empty arrays.
   * For now it returns a fixed empty structure that the UI handles correctly
   * (filter panel simply shows no format/genre groups until the column lands).
   *
   * @returns {{ formats: string[], genres: string[] }}
   */
  async function getFilterOptions() {
    // When codec_summary column exists this will aggregate across all rows.
    // For v1 it returns empty lists — the UI renders no filter groups.
    return { formats: [], genres: [] };
  }

  return {
    getFilterOptions,
    listReconciliationsByMetadataReleaseIds,
    listLibraryReleasesWithMetadata,
    replaceLibraryReleaseReconciliations,
  };
}
