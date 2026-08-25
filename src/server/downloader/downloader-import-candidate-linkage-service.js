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

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeTimestamp(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeTransferForLookup(transfer) {
  const id = normalizeString(transfer?.id);
  const username = normalizeString(transfer?.username ?? transfer?.sourceUser);
  const transferKey = normalizeString(transfer?.transferKey);

  if (!id || !username || !transferKey) {
    return null;
  }

  return {
    id,
    transfer_key: transferKey,
    username,
  };
}

function buildImportCandidateLinkage(row) {
  return {
    candidateId: row.import_candidate_id,
    candidateStatus: row.candidate_status ?? null,
    executionItemStatus: row.execution_item_status ?? null,
    linkedAt: normalizeTimestamp(row.linked_at),
    operationRunId: row.operation_run_id ?? null,
    sourceSearchId: row.source_search_id ?? null,
    status: 'linked',
    summary: 'Linked to Import Review candidate.',
  };
}

export function createDownloaderImportCandidateLinkageService({
  getPoolFn = getPool,
} = {}) {
  async function buildTransferImportCandidateLinkage({ transfers = [] } = {}) {
    const lookupTransfers = Array.isArray(transfers)
      ? transfers.map(normalizeTransferForLookup).filter(Boolean)
      : [];

    if (lookupTransfers.length < 1) {
      return new Map();
    }

    const pool = getPoolFn();
    const result = await pool.query(
      `
        WITH requested_transfers AS (
          SELECT transfer_key, username, id
          FROM jsonb_to_recordset($1::jsonb) AS t(
            transfer_key text,
            username text,
            id text
          )
        ),
        matched_items AS (
          SELECT DISTINCT ON (rt.transfer_key)
            rt.transfer_key,
            links.import_candidate_id,
            iei.item_status AS execution_item_status,
            links.operation_run_id,
            links.linked_at,
            ic.source_search_id,
            ic.status AS candidate_status
          FROM requested_transfers rt
          JOIN import_execution_transfer_links AS links
            ON links.provider = 'slskd'
            AND links.provider_transfer_id = rt.id
            AND links.source_username = rt.username
          JOIN import_execution_run_items AS iei
            ON iei.id = links.import_execution_run_item_id
            AND iei.operation_run_id = links.operation_run_id
            AND iei.import_candidate_id = links.import_candidate_id
          JOIN import_candidates AS ic ON ic.id = links.import_candidate_id
          ORDER BY rt.transfer_key, links.linked_at DESC NULLS LAST, links.id DESC
        )
        SELECT *
        FROM matched_items
      `,
      [JSON.stringify(lookupTransfers)],
    );

    return new Map(
      result.rows.map((row) => [
        row.transfer_key,
        buildImportCandidateLinkage(row),
      ]),
    );
  }

  return {
    buildTransferImportCandidateLinkage,
  };
}
