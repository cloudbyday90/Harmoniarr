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
import { normalizeOperatorReleaseGroupSelectionRow } from './operator-release-group-selection-policy.js';

export function createOperatorReleaseGroupSelectionStore({
  getPoolFn = getPool,
} = {}) {
  async function listOperatorReleaseGroupSelections({
    appUserId = null,
    metadataArtistId = null,
    queryable = null,
  } = {}) {
    const queryTarget = queryable ?? getPoolFn();
    const clauses = [];
    const params = [];

    if (appUserId) {
      params.push(appUserId);
      clauses.push(`app_user_id = $${params.length}`);
    }
    if (metadataArtistId) {
      params.push(metadataArtistId);
      clauses.push(`metadata_artist_id = $${params.length}`);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await queryTarget.query(
      `
        SELECT *
        FROM operator_release_group_selection
        ${whereClause}
        ORDER BY app_user_id ASC, metadata_artist_id ASC, metadata_release_group_id ASC
      `,
      params,
    );

    return result.rows.map((row) => normalizeOperatorReleaseGroupSelectionRow(row));
  }

  async function getOperatorReleaseGroupSelection({
    appUserId,
    metadataReleaseGroupId,
  }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT *
        FROM operator_release_group_selection
        WHERE app_user_id = $1
          AND metadata_release_group_id = $2
        LIMIT 1
      `,
      [appUserId, metadataReleaseGroupId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return normalizeOperatorReleaseGroupSelectionRow(result.rows[0]);
  }

  async function upsertOperatorReleaseGroupSelection({
    appUserId,
    metadataArtistId,
    metadataReleaseGroupId,
    queryable = null,
    resolvedMetadataReleaseId = null,
    selectionSource,
    selectionState,
  }) {
    const queryTarget = queryable ?? getPoolFn();
    await queryTarget.query(
      `
        INSERT INTO operator_release_group_selection (
          app_user_id,
          metadata_artist_id,
          metadata_release_group_id,
          selection_state,
          resolved_metadata_release_id,
          selection_source,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (app_user_id, metadata_release_group_id) DO UPDATE
        SET metadata_artist_id = EXCLUDED.metadata_artist_id,
            selection_state = EXCLUDED.selection_state,
            resolved_metadata_release_id = EXCLUDED.resolved_metadata_release_id,
            selection_source = EXCLUDED.selection_source,
            updated_at = NOW()
      `,
      [
        appUserId,
        metadataArtistId,
        metadataReleaseGroupId,
        selectionState,
        resolvedMetadataReleaseId,
        selectionSource,
      ],
    );
  }

  async function replaceOperatorArtistReleaseGroupSelections({
    appUserId,
    metadataArtistId,
    operatorReleaseGroupSelections = [],
    queryable = null,
  }) {
    const queryTarget = queryable ?? getPoolFn();
    await queryTarget.query(
      `
        DELETE FROM operator_release_group_selection
        WHERE app_user_id = $1
          AND metadata_artist_id = $2
      `,
      [appUserId, metadataArtistId],
    );

    for (const selection of operatorReleaseGroupSelections) {
      await upsertOperatorReleaseGroupSelection({
        appUserId,
        metadataArtistId,
        metadataReleaseGroupId: selection.metadataReleaseGroupId,
        queryable: queryTarget,
        resolvedMetadataReleaseId: selection.resolvedMetadataReleaseId ?? null,
        selectionSource: selection.selectionSource,
        selectionState: selection.selectionState,
      });
    }
  }

  async function listOperatorReleaseGroupSelectionsSnapshot() {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT *
        FROM operator_release_group_selection
        ORDER BY app_user_id ASC, metadata_artist_id ASC, metadata_release_group_id ASC
      `,
    );

    return result.rows.map((row) => normalizeOperatorReleaseGroupSelectionRow(row));
  }

  async function replaceOperatorReleaseGroupSelectionsSnapshot({
    operatorReleaseGroupSelections = [],
  } = {}) {
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM operator_release_group_selection');

      for (const row of operatorReleaseGroupSelections) {
        await client.query(
          `
            INSERT INTO operator_release_group_selection (
              app_user_id,
              metadata_artist_id,
              metadata_release_group_id,
              selection_state,
              resolved_metadata_release_id,
              selection_source,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
          `,
          [
            row.appUserId,
            row.metadataArtistId,
            row.metadataReleaseGroupId,
            row.selectionState,
            row.resolvedMetadataReleaseId ?? null,
            row.selectionSource,
          ],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    getOperatorReleaseGroupSelection,
    listOperatorReleaseGroupSelections,
    listOperatorReleaseGroupSelectionsSnapshot,
    replaceOperatorArtistReleaseGroupSelections,
    replaceOperatorReleaseGroupSelectionsSnapshot,
    upsertOperatorReleaseGroupSelection,
  };
}
