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

const provider = 'slskd';

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeConfirmedTransfer(transfer) {
  const providerTransferId = normalizeString(transfer?.id);
  const sourceUsername = normalizeString(transfer?.username ?? transfer?.sourceUser);

  if (!providerTransferId || !sourceUsername) {
    return null;
  }

  return {
    provider,
    providerTransferId,
    sourceUsername,
  };
}

function transferIdentityKey({ providerTransferId, sourceUsername }) {
  return `${sourceUsername}\u0000${providerTransferId}`;
}

function normalizeConfirmedTransfers(transfers) {
  const uniqueTransfers = new Map();

  for (const transfer of Array.isArray(transfers) ? transfers : []) {
    const normalized = normalizeConfirmedTransfer(transfer);
    if (normalized) {
      uniqueTransfers.set(transferIdentityKey(normalized), normalized);
    }
  }

  return Array.from(uniqueTransfers.values());
}

function normalizeTimestamp(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapTransferLink(row) {
  return {
    id: row.id,
    importCandidateId: row.import_candidate_id,
    importExecutionRunItemId: row.import_execution_run_item_id,
    linkedAt: normalizeTimestamp(row.linked_at),
    operationRunId: row.operation_run_id,
    provider: row.provider,
    providerTransferId: row.provider_transfer_id,
    sourceUsername: row.source_username,
  };
}

function createTransferLinkError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertExpectedLinks({
  importCandidateId,
  links,
  operationRunId,
  transfers,
}) {
  const linksByIdentity = new Map(links.map((link) => [transferIdentityKey(link), link]));

  for (const transfer of transfers) {
    const link = linksByIdentity.get(transferIdentityKey(transfer));
    if (!link) {
      throw createTransferLinkError(
        'import_execution_transfer_link_target_missing',
        'Confirmed transfer linkage could not find the import execution item.',
      );
    }

    if (link.operationRunId !== operationRunId || link.importCandidateId !== importCandidateId) {
      throw createTransferLinkError(
        'import_execution_transfer_link_conflict',
        'Confirmed transfer is already linked to a different import execution item.',
      );
    }
  }
}

/**
 * Records only provider-confirmed identities. The `ON CONFLICT DO NOTHING`
 * path is deliberately verified before it is treated as an idempotent retry;
 * an identity linked to another candidate/run is an integrity failure, not a
 * reason to overwrite historical evidence.
 */
export function createImportExecutionTransferLinkStore({
  getPoolFn = getPool,
} = {}) {
  async function recordConfirmedTransfers({
    importCandidateId,
    operationRunId,
    transfers = [],
  } = {}) {
    const normalizedImportCandidateId = normalizeString(importCandidateId);
    const normalizedOperationRunId = normalizeString(operationRunId);
    const normalizedTransfers = normalizeConfirmedTransfers(transfers);

    if (normalizedTransfers.length < 1) {
      return [];
    }

    if (!normalizedImportCandidateId || !normalizedOperationRunId) {
      throw createTransferLinkError(
        'import_execution_transfer_link_target_invalid',
        'A confirmed transfer link requires an import candidate and operation run.',
      );
    }

    const pool = getPoolFn();
    const result = await pool.query(
      `
        WITH requested_transfers AS (
          SELECT provider, source_username, provider_transfer_id
          FROM jsonb_to_recordset($3::jsonb) AS transfer(
            provider text,
            source_username text,
            provider_transfer_id text
          )
        ),
        target_item AS (
          SELECT id, operation_run_id, import_candidate_id
          FROM import_execution_run_items
          WHERE operation_run_id = $1
            AND import_candidate_id = $2
        ),
        inserted_links AS (
          INSERT INTO import_execution_transfer_links (
            import_execution_run_item_id,
            operation_run_id,
            import_candidate_id,
            provider,
            source_username,
            provider_transfer_id
          )
          SELECT
            target_item.id,
            target_item.operation_run_id,
            target_item.import_candidate_id,
            requested_transfers.provider,
            requested_transfers.source_username,
            requested_transfers.provider_transfer_id
          FROM target_item
          CROSS JOIN requested_transfers
          ON CONFLICT (provider, source_username, provider_transfer_id) DO NOTHING
          RETURNING *
        ),
        existing_links AS (
          SELECT links.*
          FROM import_execution_transfer_links AS links
          INNER JOIN requested_transfers AS requested
            ON requested.provider = links.provider
            AND requested.source_username = links.source_username
            AND requested.provider_transfer_id = links.provider_transfer_id
        )
        SELECT *
        FROM inserted_links
        UNION ALL
        SELECT *
        FROM existing_links
        ORDER BY source_username ASC, provider_transfer_id ASC
      `,
      [
        normalizedOperationRunId,
        normalizedImportCandidateId,
        JSON.stringify(normalizedTransfers.map((transfer) => ({
          provider: transfer.provider,
          provider_transfer_id: transfer.providerTransferId,
          source_username: transfer.sourceUsername,
        }))),
      ],
    );

    const links = result.rows.map(mapTransferLink);
    assertExpectedLinks({
      importCandidateId: normalizedImportCandidateId,
      links,
      operationRunId: normalizedOperationRunId,
      transfers: normalizedTransfers,
    });

    return links;
  }

  return {
    recordConfirmedTransfers,
  };
}
