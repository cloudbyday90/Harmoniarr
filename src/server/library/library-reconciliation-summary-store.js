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

function toInteger(value) {
  return Number.parseInt(String(value ?? 0), 10) || 0;
}

function mapFileCounts(row) {
  return {
    ambiguous: toInteger(row.ambiguous_file_count),
    ignored: toInteger(row.ignored_file_count),
    matched: toInteger(row.matched_file_count),
    observed: toInteger(row.observed_file_count),
    unmatched: toInteger(row.unmatched_file_count),
  };
}

function mapReleaseCounts(row) {
  return {
    complete: toInteger(row.complete_release_count),
    duplicate: toInteger(row.duplicate_release_count),
    partial: toInteger(row.partial_release_count),
  };
}

export function createLibraryReconciliationSummaryStore({
  getPoolFn = getPool,
} = {}) {
  async function getLibraryReconciliationSnapshot() {
    const pool = getPoolFn();
    const [fileCountsResult, releaseCountsResult] = await Promise.all([
      pool.query(
        `
          SELECT
            COUNT(*) FILTER (WHERE library_files.file_state = 'observed')::integer AS observed_file_count,
            COUNT(*) FILTER (
              WHERE library_files.file_state = 'observed'
                AND library_file_matches.match_status = 'matched'
            )::integer AS matched_file_count,
            COUNT(*) FILTER (
              WHERE library_files.file_state = 'observed'
                AND library_file_matches.match_status = 'ambiguous'
            )::integer AS ambiguous_file_count,
            COUNT(*) FILTER (
              WHERE library_files.file_state = 'observed'
                AND library_file_matches.match_status = 'unmatched'
            )::integer AS unmatched_file_count,
            COUNT(*) FILTER (WHERE library_files.file_state = 'ignored')::integer AS ignored_file_count
          FROM library_files
          LEFT JOIN library_file_matches ON library_file_matches.library_file_id = library_files.id
          WHERE library_files.deleted_at IS NULL
        `,
      ),
      pool.query(
        `
          SELECT
            COUNT(*) FILTER (
              WHERE reconciliation_status = 'complete'
            )::integer AS complete_release_count,
            COUNT(*) FILTER (
              WHERE reconciliation_status = 'partial'
            )::integer AS partial_release_count,
            COUNT(*) FILTER (
              WHERE reconciliation_status = 'duplicate'
            )::integer AS duplicate_release_count,
            MAX(last_reconciled_at) AS last_reconciled_at
          FROM library_release_reconciliations
        `,
      ),
    ]);

    return {
      fileCounts: mapFileCounts(fileCountsResult.rows[0] ?? {}),
      lastReconciledAt: releaseCountsResult.rows[0]?.last_reconciled_at ?? null,
      releaseCounts: mapReleaseCounts(releaseCountsResult.rows[0] ?? {}),
    };
  }

  return {
    getLibraryReconciliationSnapshot,
  };
}